/**
 * Tags API Routes
 * GET /api/tags - List all tags
 * POST /api/tags - Create a new tag
 *
 * Requirements:
 * - 14.1: Store tag name and color
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { desc, asc, like, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tags, type NewTag } from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  requireRole,
  handleAuthError,
  handleRoleError,
} from '@/lib/auth/middleware';
import { logError } from '@/lib/logger';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Zod schema for creating a tag
const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)'),
});

// Query params schema
const listQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const Route = createFileRoute('/api/tags/')({
  server: {
    handlers: {
      /**
       * GET /api/tags
       * List all tags
       */
      GET: async ({ request }) => {
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
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get('search') || undefined,
            sortBy: url.searchParams.get('sortBy') || 'name',
            sortOrder: url.searchParams.get('sortOrder') || 'asc',
            page: url.searchParams.get('page') || '1',
            limit: url.searchParams.get('limit') || '50',
          };

          const parsed = listQuerySchema.safeParse(queryParams);
          if (!parsed.success) {
            return json(
              { error: 'Invalid query parameters', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { search, sortBy, sortOrder, page, limit } = parsed.data;
          const offset = (page - 1) * limit;

          // Build sort order
          const sortColumn = {
            name: tags.name,
            createdAt: tags.createdAt,
          }[sortBy];

          const orderFn = sortOrder === 'asc' ? asc : desc;

          // Execute query
          let query = db.select().from(tags);

          if (search) {
            query = query.where(like(tags.name, `%${search}%`)) as typeof query;
          }

          const tagList = await query.orderBy(orderFn(sortColumn)).limit(limit).offset(offset);

          // Get total count
          let countQuery = db.select({ count: sql<number>`count(*)` }).from(tags);
          if (search) {
            countQuery = countQuery.where(like(tags.name, `%${search}%`)) as typeof countQuery;
          }
          const countResult = await countQuery;
          const total = countResult[0]?.count ?? 0;

          return json({
            data: tagList,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          logError('[GET /api/tags] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to fetch tags' }, { status: 500 });
        }
      },

      /**
       * POST /api/tags
       * Create a new tag
       */
      POST: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least MANAGER role to create tags
        const roleCheck = requireRole(auth.user, 'MANAGER');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const body = await request.json();
          const parsed = createTagSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const tagData: NewTag = {
            id: randomUUID(),
            name: parsed.data.name,
            color: parsed.data.color,
          };

          const result = await db.insert(tags).values(tagData).returning();
          const newTag = result[0];

          return json({ data: newTag }, { status: 201 });
        } catch (error) {
          // Check for unique constraint violation
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return json({ error: 'A tag with this name already exists' }, { status: 409 });
          }
          logError('[POST /api/tags] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to create tag' }, { status: 500 });
        }
      },
    },
  },
});
