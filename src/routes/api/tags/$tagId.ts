/**
 * Single Tag API Routes
 * GET /api/tags/:tagId - Get single tag
 * PUT /api/tags/:tagId - Update tag
 * DELETE /api/tags/:tagId - Delete tag
 *
 * Requirements:
 * - 14.1: Store tag name and color
 * - 14.4: Remove tag from entity
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  requireRole,
  handleAuthError,
  handleRoleError,
} from '@/lib/auth/middleware';
import { logError } from '@/lib/logger';
import { z } from 'zod';

// Zod schema for updating a tag
const updateTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)')
    .optional(),
});

export const Route = createFileRoute('/api/tags/$tagId')({
  server: {
    handlers: {
      /**
       * GET /api/tags/:tagId
       * Get single tag
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least MEMBER role to view tags
        const roleCheck = requireRole(auth.user, 'MEMBER');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { tagId } = params;

          const tagResult = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);

          const tag = tagResult[0];

          if (!tag) {
            return json({ error: 'Tag not found' }, { status: 404 });
          }

          return json({ data: tag });
        } catch (error) {
          logError('[GET /api/tags/:tagId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to fetch tag' }, { status: 500 });
        }
      },

      /**
       * PUT /api/tags/:tagId
       * Update tag
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least ADMIN role to update tags
        const roleCheck = requireRole(auth.user, 'ADMIN');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { tagId } = params;

          // Check if tag exists
          const existingTag = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);

          if (existingTag.length === 0) {
            return json({ error: 'Tag not found' }, { status: 404 });
          }

          const body = await request.json();
          const parsed = updateTagSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Build update data
          const updateData: Record<string, unknown> = {};

          if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
          if (parsed.data.color !== undefined) updateData.color = parsed.data.color;

          if (Object.keys(updateData).length === 0) {
            return json({ error: 'No fields to update' }, { status: 400 });
          }

          const result = await db.update(tags).set(updateData).where(eq(tags.id, tagId)).returning();

          const updatedTag = result[0];

          return json({ data: updatedTag });
        } catch (error) {
          // Check for unique constraint violation
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return json({ error: 'A tag with this name already exists' }, { status: 409 });
          }
          logError('[PUT /api/tags/:tagId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to update tag' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/tags/:tagId
       * Delete tag (cascade deletes taggables)
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least ADMIN role to delete tags
        const roleCheck = requireRole(auth.user, 'ADMIN');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { tagId } = params;

          // Check if tag exists
          const existingTag = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);

          if (existingTag.length === 0) {
            return json({ error: 'Tag not found' }, { status: 404 });
          }

          // Delete the tag (taggables will be cascade deleted due to FK constraint)
          await db.delete(tags).where(eq(tags.id, tagId));

          return json({ success: true, message: 'Tag deleted successfully' });
        } catch (error) {
          logError('[DELETE /api/tags/:tagId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to delete tag' }, { status: 500 });
        }
      },
    },
  },
});
