/**
 * Notes API Routes
 * GET /api/notes - List notes for project/client
 * POST /api/notes - Create a new note with encrypted secret
 *
 * Requirements:
 * - 7.1: Store note information with type, system name, host, port, username, encrypted secret
 * - 7.2: Encrypt secret using AES-256-GCM before database storage
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, like, or, desc, asc, sql, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  notes,
  noteTypeValues,
  projects,
  projectMembers,
  clients,
  type NewNote,
} from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from '@/lib/auth/middleware';
import { canAccessProject } from '@/lib/auth/permissions';
import { encryptSecret } from '@/lib/security/crypto';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Zod schema for creating a note
const createNoteSchema = z.object({
  type: z.enum(noteTypeValues).default('OTHER'),
  systemName: z.string().min(1, 'System name is required').max(255),
  clientId: z.string().uuid('Invalid client ID').optional().nullable(),
  projectId: z.string().uuid('Invalid project ID').optional().nullable(),
  host: z.string().max(255).optional().nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  secret: z.string().min(1, 'Secret is required'),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Query params schema
const listQuerySchema = z.object({
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  type: z.enum(noteTypeValues).optional(),
  sortBy: z.enum(['systemName', 'type', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const Route = createFileRoute('/api/notes/')({
  server: {
    handlers: {
      /**
       * GET /api/notes
       * List notes with filters for project/client
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get('search') || undefined,
            projectId: url.searchParams.get('projectId') || undefined,
            clientId: url.searchParams.get('clientId') || undefined,
            type: url.searchParams.get('type') || undefined,
            sortBy: url.searchParams.get('sortBy') || 'createdAt',
            sortOrder: url.searchParams.get('sortOrder') || 'desc',
            page: url.searchParams.get('page') || '1',
            limit: url.searchParams.get('limit') || '20',
          };

          const parsed = listQuerySchema.safeParse(queryParams);
          if (!parsed.success) {
            return json(
              { error: 'Invalid query parameters', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { search, projectId, clientId, type, sortBy, sortOrder, page, limit } = parsed.data;
          const offset = (page - 1) * limit;

          // Build conditions based on user access
          const conditions = [];

          // If specific project requested, verify access
          if (projectId) {
            const hasAccess = await canAccessProject(auth.user, projectId);
            if (!hasAccess) {
              return json({ error: 'Access denied to this project' }, { status: 403 });
            }
            conditions.push(eq(notes.projectId, projectId));
          } else if (clientId) {
            // Client-level notes - only SUPER_ADMIN and ADMIN can access
            if (auth.user.role !== 'SUPER_ADMIN' && auth.user.role !== 'ADMIN') {
              return json({ error: 'Access denied to client notes' }, { status: 403 });
            }
            conditions.push(eq(notes.clientId, clientId));
          } else {
            // No specific filter - get notes from accessible projects
            if (auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN') {
              // Admin users can see all notes
            } else {
              // Non-admin users: filter by project membership or manager role
              const memberProjects = await db
                .select({ projectId: projectMembers.projectId })
                .from(projectMembers)
                .where(eq(projectMembers.userId, auth.user.id));

              const memberProjectIds = memberProjects.map((p) => p.projectId);

              const managedProjects = await db
                .select({ id: projects.id })
                .from(projects)
                .where(eq(projects.managerId, auth.user.id));

              const managedProjectIds = managedProjects.map((p) => p.id);

              const accessibleProjectIds = [...new Set([...memberProjectIds, ...managedProjectIds])];

              if (accessibleProjectIds.length === 0) {
                // Also include notes created by the user
                conditions.push(eq(notes.createdBy, auth.user.id));
              } else {
                conditions.push(
                  or(
                    inArray(notes.projectId, accessibleProjectIds),
                    eq(notes.createdBy, auth.user.id)
                  )!
                );
              }
            }
          }

          if (search) {
            conditions.push(
              or(
                like(notes.systemName, `%${search}%`),
                like(notes.host, `%${search}%`),
                like(notes.username, `%${search}%`)
              )
            );
          }

          if (type) {
            conditions.push(eq(notes.type, type));
          }

          // Build sort order
          const sortColumn = {
            systemName: notes.systemName,
            type: notes.type,
            createdAt: notes.createdAt,
            updatedAt: notes.updatedAt,
          }[sortBy];

          const orderFn = sortOrder === 'asc' ? asc : desc;

          // Execute query - exclude secret field for security
          let query = db
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
            .from(notes);

          if (conditions.length > 0) {
            query = query.where(and(...conditions)) as typeof query;
          }

          const noteList = await query
            .orderBy(orderFn(sortColumn))
            .limit(limit)
            .offset(offset);

          // Get total count
          let countQuery = db.select({ count: sql<number>`count(*)` }).from(notes);
          if (conditions.length > 0) {
            countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
          }
          const countResult = await countQuery;
          const total = countResult[0]?.count ?? 0;

          return json({
            data: noteList,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          console.error('[GET /api/notes] Error:', error);
          return json({ error: 'Failed to fetch notes' }, { status: 500 });
        }
      },

      /**
       * POST /api/notes
       * Create a new note with encrypted secret
       */
      POST: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // GUEST users cannot create notes
        if (auth.user.role === 'GUEST') {
          return json({ error: 'Access denied' }, { status: 403 });
        }

        try {
          const body = await request.json();
          const parsed = createNoteSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify project exists and user has access if projectId provided
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
              return json({ error: 'Access denied to this project' }, { status: 403 });
            }
          }

          // Verify client exists if clientId provided
          if (parsed.data.clientId) {
            const clientResult = await db
              .select({ id: clients.id })
              .from(clients)
              .where(eq(clients.id, parsed.data.clientId))
              .limit(1);

            if (clientResult.length === 0) {
              return json({ error: 'Client not found' }, { status: 404 });
            }

            // Only SUPER_ADMIN and ADMIN can create client-level notes
            if (auth.user.role !== 'SUPER_ADMIN' && auth.user.role !== 'ADMIN') {
              return json({ error: 'Access denied to create client notes' }, { status: 403 });
            }
          }

          // Encrypt the secret before storage (Requirement 7.2)
          const encryptedSecret = encryptSecret(parsed.data.secret);

          const noteData: NewNote = {
            id: randomUUID(),
            type: parsed.data.type,
            systemName: parsed.data.systemName,
            clientId: parsed.data.clientId || null,
            projectId: parsed.data.projectId || null,
            host: parsed.data.host || null,
            port: parsed.data.port || null,
            username: parsed.data.username || null,
            secret: encryptedSecret,
            metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
            createdBy: auth.user.id,
            updatedBy: auth.user.id,
          };

          const result = await db.insert(notes).values(noteData).returning();
          const newNote = result[0]!;

          // Return note without the encrypted secret
          const { secret: _, ...noteWithoutSecret } = newNote;

          return json({ data: noteWithoutSecret }, { status: 201 });
        } catch (error) {
          console.error('[POST /api/notes] Error:', error);
          return json({ error: 'Failed to create note' }, { status: 500 });
        }
      },
    },
  },
});
