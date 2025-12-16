/**
 * Single Note API Routes
 * GET /api/notes/:noteId - Get single note without secret
 * PUT /api/notes/:noteId - Update note
 * DELETE /api/notes/:noteId - Delete note
 *
 * Requirements:
 * - 7.1: Store note information
 * - 7.2: Encrypt secret using AES-256-GCM
 * - 7.7: Mask secret values by default
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notes, noteTypeValues, projects, clients } from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from '@/lib/auth/middleware';
import { canAccessNote, canAccessProject } from '@/lib/auth/permissions';
import { encryptSecret } from '@/lib/security/crypto';
import { z } from 'zod';

// Zod schema for updating a note
const updateNoteSchema = z.object({
  type: z.enum(noteTypeValues).optional(),
  systemName: z.string().min(1, 'System name is required').max(255).optional(),
  clientId: z.string().uuid('Invalid client ID').optional().nullable(),
  projectId: z.string().uuid('Invalid project ID').optional().nullable(),
  host: z.string().max(255).optional().nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  secret: z.string().min(1, 'Secret is required').optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const Route = createFileRoute('/api/notes/$noteId')({
  server: {
    handlers: {
      /**
       * GET /api/notes/:noteId
       * Get single note without secret (masked)
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { noteId } = params;

          // Check if user can access this note
          const hasAccess = await canAccessNote(auth.user, noteId);
          if (!hasAccess) {
            return json({ error: 'Access denied' }, { status: 403 });
          }

          // Fetch note without secret
          const noteResult = await db
            .select({
              id: notes.id,
              type: notes.type,
              systemName: notes.systemName,
              clientId: notes.clientId,
              projectId: notes.projectId,
              host: notes.host,
              port: notes.port,
              username: notes.username,
              metadata: notes.metadata,
              createdBy: notes.createdBy,
              updatedBy: notes.updatedBy,
              createdAt: notes.createdAt,
              updatedAt: notes.updatedAt,
            })
            .from(notes)
            .where(eq(notes.id, noteId))
            .limit(1);

          const note = noteResult[0];

          if (!note) {
            return json({ error: 'Note not found' }, { status: 404 });
          }

          return json({ data: note });
        } catch (error) {
          console.error('[GET /api/notes/:noteId] Error:', error);
          return json({ error: 'Failed to fetch note' }, { status: 500 });
        }
      },

      /**
       * PUT /api/notes/:noteId
       * Update note
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // GUEST users cannot update notes
        if (auth.user.role === 'GUEST') {
          return json({ error: 'Access denied' }, { status: 403 });
        }

        try {
          const { noteId } = params;

          // Check if note exists and user has access
          const existingNote = await db
            .select()
            .from(notes)
            .where(eq(notes.id, noteId))
            .limit(1);

          if (existingNote.length === 0) {
            return json({ error: 'Note not found' }, { status: 404 });
          }

          const note = existingNote[0]!;

          // Check access - creator can always edit, or check project/admin access
          const isCreator = note.createdBy === auth.user.id;
          const isAdmin = auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN';
          
          if (!isCreator && !isAdmin) {
            // Check project access for managers
            if (note.projectId) {
              const hasAccess = await canAccessProject(auth.user, note.projectId);
              if (!hasAccess || auth.user.role === 'MEMBER') {
                return json({ error: 'Access denied' }, { status: 403 });
              }
            } else {
              return json({ error: 'Access denied' }, { status: 403 });
            }
          }

          const body = await request.json();
          const parsed = updateNoteSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify new project exists and user has access if projectId is being changed
          if (parsed.data.projectId !== undefined && parsed.data.projectId !== note.projectId) {
            if (parsed.data.projectId) {
              const projectResult = await db
                .select({ id: projects.id })
                .from(projects)
                .where(eq(projects.id, parsed.data.projectId))
                .limit(1);

              if (projectResult.length === 0) {
                return json({ error: 'Project not found' }, { status: 404 });
              }

              const hasAccess = await canAccessProject(auth.user, parsed.data.projectId);
              if (!hasAccess) {
                return json({ error: 'Access denied to target project' }, { status: 403 });
              }
            }
          }

          // Verify new client exists if clientId is being changed
          if (parsed.data.clientId !== undefined && parsed.data.clientId !== note.clientId) {
            if (parsed.data.clientId) {
              const clientResult = await db
                .select({ id: clients.id })
                .from(clients)
                .where(eq(clients.id, parsed.data.clientId))
                .limit(1);

              if (clientResult.length === 0) {
                return json({ error: 'Client not found' }, { status: 404 });
              }

              // Only SUPER_ADMIN and ADMIN can set client-level notes
              if (!isAdmin) {
                return json({ error: 'Access denied to set client notes' }, { status: 403 });
              }
            }
          }

          // Build update data
          const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
            updatedBy: auth.user.id,
          };

          if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
          if (parsed.data.systemName !== undefined) updateData.systemName = parsed.data.systemName;
          if (parsed.data.clientId !== undefined) updateData.clientId = parsed.data.clientId;
          if (parsed.data.projectId !== undefined) updateData.projectId = parsed.data.projectId;
          if (parsed.data.host !== undefined) updateData.host = parsed.data.host;
          if (parsed.data.port !== undefined) updateData.port = parsed.data.port;
          if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
          if (parsed.data.metadata !== undefined) {
            updateData.metadata = parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null;
          }

          // If secret is being updated, encrypt it
          if (parsed.data.secret !== undefined) {
            updateData.secret = encryptSecret(parsed.data.secret);
          }

          const result = await db
            .update(notes)
            .set(updateData)
            .where(eq(notes.id, noteId))
            .returning({
              id: notes.id,
              type: notes.type,
              systemName: notes.systemName,
              clientId: notes.clientId,
              projectId: notes.projectId,
              host: notes.host,
              port: notes.port,
              username: notes.username,
              metadata: notes.metadata,
              createdBy: notes.createdBy,
              updatedBy: notes.updatedBy,
              createdAt: notes.createdAt,
              updatedAt: notes.updatedAt,
            });

          const updatedNote = result[0];

          return json({ data: updatedNote });
        } catch (error) {
          console.error('[PUT /api/notes/:noteId] Error:', error);
          return json({ error: 'Failed to update note' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/notes/:noteId
       * Delete note
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // GUEST users cannot delete notes
        if (auth.user.role === 'GUEST') {
          return json({ error: 'Access denied' }, { status: 403 });
        }

        try {
          const { noteId } = params;

          // Check if note exists
          const existingNote = await db
            .select()
            .from(notes)
            .where(eq(notes.id, noteId))
            .limit(1);

          if (existingNote.length === 0) {
            return json({ error: 'Note not found' }, { status: 404 });
          }

          const note = existingNote[0]!;

          // Check access - creator can always delete, or check admin access
          const isCreator = note.createdBy === auth.user.id;
          const isAdmin = auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN';
          
          if (!isCreator && !isAdmin) {
            // Check project access for managers
            if (note.projectId) {
              const hasAccess = await canAccessProject(auth.user, note.projectId);
              if (!hasAccess || auth.user.role === 'MEMBER') {
                return json({ error: 'Access denied' }, { status: 403 });
              }
            } else {
              return json({ error: 'Access denied' }, { status: 403 });
            }
          }

          // Delete the note (note_access_logs will be cascade deleted)
          await db.delete(notes).where(eq(notes.id, noteId));

          return json({ success: true, message: 'Note deleted successfully' });
        } catch (error) {
          console.error('[DELETE /api/notes/:noteId] Error:', error);
          return json({ error: 'Failed to delete note' }, { status: 500 });
        }
      },
    },
  },
});
