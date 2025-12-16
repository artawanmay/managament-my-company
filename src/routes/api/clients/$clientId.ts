/**
 * Single Client API Routes
 * GET /api/clients/:clientId - Get single client with projects
 * PUT /api/clients/:clientId - Update client
 * DELETE /api/clients/:clientId - Delete client
 *
 * Requirements:
 * - 3.4: View client detail page with projects
 * - 3.5: Edit client with validation
 * - 3.6: Delete client with referential integrity check
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, projects, clientStatusValues } from '@/lib/db/schema';
import { requireAuth, requireAuthWithCsrf, requireRole, handleAuthError, handleRoleError } from '@/lib/auth/middleware';
import { z } from 'zod';

// Zod schema for updating a client
const updateClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  picName: z.string().max(255).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  website: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  status: z.enum(clientStatusValues).optional(),
  notes: z.string().optional().nullable(),
});

export const Route = createFileRoute('/api/clients/$clientId')({
  server: {
    handlers: {
      /**
       * GET /api/clients/:clientId
       * Get single client with associated projects
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least MEMBER role to view clients
        const roleCheck = requireRole(auth.user, 'MEMBER');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { clientId } = params;

          // Fetch client
          const clientResult = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);

          const client = clientResult[0];

          if (!client) {
            return json({ error: 'Client not found' }, { status: 404 });
          }

          // Fetch associated projects
          const clientProjects = await db
            .select({
              id: projects.id,
              name: projects.name,
              status: projects.status,
              priority: projects.priority,
              startDate: projects.startDate,
              endDate: projects.endDate,
            })
            .from(projects)
            .where(eq(projects.clientId, clientId));

          return json({
            data: {
              ...client,
              projects: clientProjects,
            },
          });
        } catch (error) {
          console.error('[GET /api/clients/:clientId] Error:', error);
          return json({ error: 'Failed to fetch client' }, { status: 500 });
        }
      },

      /**
       * PUT /api/clients/:clientId
       * Update client
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least ADMIN role to update clients
        const roleCheck = requireRole(auth.user, 'ADMIN');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { clientId } = params;

          // Check if client exists
          const existingClient = await db
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);

          if (existingClient.length === 0) {
            return json({ error: 'Client not found' }, { status: 404 });
          }

          const body = await request.json();
          const parsed = updateClientSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Build update data, only including provided fields
          const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
          if (parsed.data.picName !== undefined) updateData.picName = parsed.data.picName;
          if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
          if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
          if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
          if (parsed.data.website !== undefined) updateData.website = parsed.data.website || null;
          if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
          if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

          const result = await db
            .update(clients)
            .set(updateData)
            .where(eq(clients.id, clientId))
            .returning();

          const updatedClient = result[0];

          return json({ data: updatedClient });
        } catch (error) {
          console.error('[PUT /api/clients/:clientId] Error:', error);
          return json({ error: 'Failed to update client' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/clients/:clientId
       * Delete client with referential integrity check
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least ADMIN role to delete clients
        const roleCheck = requireRole(auth.user, 'ADMIN');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { clientId } = params;

          // Check if client exists
          const existingClient = await db
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);

          if (existingClient.length === 0) {
            return json({ error: 'Client not found' }, { status: 404 });
          }

          // Check for associated projects (referential integrity)
          const associatedProjects = await db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.clientId, clientId))
            .limit(1);

          if (associatedProjects.length > 0) {
            return json(
              {
                error: 'Cannot delete client with associated projects. Please delete or reassign projects first.',
              },
              { status: 409 }
            );
          }

          // Delete the client
          await db.delete(clients).where(eq(clients.id, clientId));

          return json({ success: true, message: 'Client deleted successfully' });
        } catch (error) {
          console.error('[DELETE /api/clients/:clientId] Error:', error);
          return json({ error: 'Failed to delete client' }, { status: 500 });
        }
      },
    },
  },
});
