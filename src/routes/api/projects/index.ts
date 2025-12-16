/**
 * Projects API Routes
 * GET /api/projects - List projects filtered by user access
 * POST /api/projects - Create a new project
 *
 * Requirements:
 * - 4.1: Store project information with client association
 * - 4.2: Display only projects user has permission to access
 * - 4.6: Hide archived projects from default views
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, like, or, desc, asc, sql, ne, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  projects,
  projectStatusValues,
  priorityValues,
  projectMembers,
  clients,
  users,
  type NewProject,
} from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  requireRole,
  handleAuthError,
  handleRoleError,
} from '@/lib/auth/middleware';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Zod schema for creating a project
const createProjectSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(projectStatusValues).default('PLANNING'),
  priority: z.enum(priorityValues).default('MEDIUM'),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  managerId: z.string().uuid('Invalid manager ID'),
});

// Query params schema
const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(projectStatusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  clientId: z.string().uuid().optional(),
  includeArchived: z.enum(['true', 'false']).default('false'),
  sortBy: z.enum(['name', 'status', 'priority', 'startDate', 'endDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const Route = createFileRoute('/api/projects/')({
  server: {
    handlers: {
      /**
       * GET /api/projects
       * List projects filtered by user access
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least MEMBER role to view projects
        const roleCheck = requireRole(auth.user, 'MEMBER');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get('search') || undefined,
            status: url.searchParams.get('status') || undefined,
            priority: url.searchParams.get('priority') || undefined,
            clientId: url.searchParams.get('clientId') || undefined,
            includeArchived: url.searchParams.get('includeArchived') || 'false',
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

          const { search, status, priority, clientId, includeArchived, sortBy, sortOrder, page, limit } = parsed.data;
          const offset = (page - 1) * limit;

          // Build base conditions
          const conditions = [];

          // Filter by search term
          if (search) {
            conditions.push(
              or(
                like(projects.name, `%${search}%`),
                like(projects.description, `%${search}%`)
              )
            );
          }

          // Filter by status
          if (status) {
            conditions.push(eq(projects.status, status));
          }

          // Filter by priority
          if (priority) {
            conditions.push(eq(projects.priority, priority));
          }

          // Filter by client
          if (clientId) {
            conditions.push(eq(projects.clientId, clientId));
          }

          // Exclude archived projects by default (Requirement 4.6)
          if (includeArchived !== 'true') {
            conditions.push(ne(projects.status, 'ARCHIVED'));
          }

          // Build sort order
          const sortColumn = {
            name: projects.name,
            status: projects.status,
            priority: projects.priority,
            startDate: projects.startDate,
            endDate: projects.endDate,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          }[sortBy];

          const orderFn = sortOrder === 'asc' ? asc : desc;

          // For SUPER_ADMIN and ADMIN, show all projects
          // For others, only show projects they have access to
          let projectList;
          let total;

          if (auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN') {
            // Admin users can see all projects
            let query = db
              .select({
                id: projects.id,
                clientId: projects.clientId,
                name: projects.name,
                description: projects.description,
                status: projects.status,
                priority: projects.priority,
                startDate: projects.startDate,
                endDate: projects.endDate,
                managerId: projects.managerId,
                createdAt: projects.createdAt,
                updatedAt: projects.updatedAt,
                clientName: clients.name,
                managerName: users.name,
              })
              .from(projects)
              .leftJoin(clients, eq(projects.clientId, clients.id))
              .leftJoin(users, eq(projects.managerId, users.id));

            if (conditions.length > 0) {
              for (const condition of conditions) {
                if (condition) {
                  query = query.where(condition) as typeof query;
                }
              }
            }

            projectList = await query
              .orderBy(orderFn(sortColumn))
              .limit(limit)
              .offset(offset);

            // Get total count
            let countQuery = db.select({ count: sql<number>`count(*)` }).from(projects);
            if (conditions.length > 0) {
              for (const condition of conditions) {
                if (condition) {
                  countQuery = countQuery.where(condition) as typeof countQuery;
                }
              }
            }
            const countResult = await countQuery;
            total = countResult[0]?.count ?? 0;
          } else {
            // Non-admin users: filter by project membership or manager role
            // First get project IDs the user has access to
            const memberProjects = await db
              .select({ projectId: projectMembers.projectId })
              .from(projectMembers)
              .where(eq(projectMembers.userId, auth.user.id));

            const memberProjectIds = memberProjects.map((p) => p.projectId);

            // Also get projects where user is the manager
            const managedProjects = await db
              .select({ id: projects.id })
              .from(projects)
              .where(eq(projects.managerId, auth.user.id));

            const managedProjectIds = managedProjects.map((p) => p.id);

            // Combine both sets of project IDs
            const accessibleProjectIds = [...new Set([...memberProjectIds, ...managedProjectIds])];

            if (accessibleProjectIds.length === 0) {
              return json({
                data: [],
                pagination: {
                  page,
                  limit,
                  total: 0,
                  totalPages: 0,
                },
              });
            }

            // Add project ID filter
            conditions.push(inArray(projects.id, accessibleProjectIds));

            let query = db
              .select({
                id: projects.id,
                clientId: projects.clientId,
                name: projects.name,
                description: projects.description,
                status: projects.status,
                priority: projects.priority,
                startDate: projects.startDate,
                endDate: projects.endDate,
                managerId: projects.managerId,
                createdAt: projects.createdAt,
                updatedAt: projects.updatedAt,
                clientName: clients.name,
                managerName: users.name,
              })
              .from(projects)
              .leftJoin(clients, eq(projects.clientId, clients.id))
              .leftJoin(users, eq(projects.managerId, users.id));

            for (const condition of conditions) {
              if (condition) {
                query = query.where(condition) as typeof query;
              }
            }

            projectList = await query
              .orderBy(orderFn(sortColumn))
              .limit(limit)
              .offset(offset);

            // Get total count
            let countQuery = db.select({ count: sql<number>`count(*)` }).from(projects);
            for (const condition of conditions) {
              if (condition) {
                countQuery = countQuery.where(condition) as typeof countQuery;
              }
            }
            const countResult = await countQuery;
            total = countResult[0]?.count ?? 0;
          }

          return json({
            data: projectList,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          console.error('[GET /api/projects] Error:', error);
          return json({ error: 'Failed to fetch projects' }, { status: 500 });
        }
      },

      /**
       * POST /api/projects
       * Create a new project
       */
      POST: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least ADMIN role to create projects
        const roleCheck = requireRole(auth.user, 'ADMIN');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const body = await request.json();
          const parsed = createProjectSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify client exists
          const clientExists = await db
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.id, parsed.data.clientId))
            .limit(1);

          if (clientExists.length === 0) {
            return json({ error: 'Client not found' }, { status: 404 });
          }

          // Verify manager exists
          const managerExists = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, parsed.data.managerId))
            .limit(1);

          if (managerExists.length === 0) {
            return json({ error: 'Manager not found' }, { status: 404 });
          }

          const projectData: NewProject = {
            id: randomUUID(),
            clientId: parsed.data.clientId,
            name: parsed.data.name,
            description: parsed.data.description || null,
            status: parsed.data.status,
            priority: parsed.data.priority,
            startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
            endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
            managerId: parsed.data.managerId,
          };

          const result = await db.insert(projects).values(projectData).returning();
          const newProject = result[0];

          return json({ data: newProject }, { status: 201 });
        } catch (error) {
          console.error('[POST /api/projects] Error:', error);
          return json({ error: 'Failed to create project' }, { status: 500 });
        }
      },
    },
  },
});
