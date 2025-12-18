/**
 * Single Project API Routes
 * GET /api/projects/:projectId - Get single project with members
 * PUT /api/projects/:projectId - Update project
 *
 * Requirements:
 * - 4.2: Display only projects user has permission to access
 * - 4.3: Display project detail with overview, Kanban, tasks, files, notes, activity
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  projectStatusValues,
  priorityValues,
  projectMembers,
  clients,
  users,
} from "@/lib/db/schema";
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
  requireProjectAccess,
  requireProjectManagement,
  handleProjectAccessError,
} from "@/lib/auth/middleware";
import { logProjectUpdated } from "@/lib/activity";
import { z } from "zod";

// Zod schema for updating a project
const updateProjectSchema = z.object({
  clientId: z.string().uuid("Invalid client ID").optional(),
  name: z.string().min(1, "Name is required").max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(projectStatusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  managerId: z.string().uuid("Invalid manager ID").optional(),
});

export const Route = createFileRoute("/api/projects/$projectId")({
  server: {
    handlers: {
      /**
       * GET /api/projects/:projectId
       * Get single project with members
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const { projectId } = params;

          // Check project access
          const accessCheck = await requireProjectAccess(auth.user, projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Fetch project with client and manager info
          const projectResult = await db
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
              managerEmail: users.email,
            })
            .from(projects)
            .leftJoin(clients, eq(projects.clientId, clients.id))
            .leftJoin(users, eq(projects.managerId, users.id))
            .where(eq(projects.id, projectId))
            .limit(1);

          const project = projectResult[0];

          if (!project) {
            return json({ error: "Project not found" }, { status: 404 });
          }

          // Fetch project members
          const members = await db
            .select({
              id: projectMembers.id,
              userId: projectMembers.userId,
              role: projectMembers.role,
              joinedAt: projectMembers.joinedAt,
              userName: users.name,
              userEmail: users.email,
              userAvatarUrl: users.avatarUrl,
            })
            .from(projectMembers)
            .leftJoin(users, eq(projectMembers.userId, users.id))
            .where(eq(projectMembers.projectId, projectId));

          return json({
            data: {
              ...project,
              members,
              canManage: accessCheck.success ? accessCheck.canManage : false,
            },
          });
        } catch (error) {
          console.error("[GET /api/projects/:projectId] Error:", error);
          return json({ error: "Failed to fetch project" }, { status: 500 });
        }
      },

      /**
       * PUT /api/projects/:projectId
       * Update project
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const { projectId } = params;

          // Check project management access
          const accessCheck = await requireProjectManagement(
            auth.user,
            projectId
          );
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Check if project exists and get current values for logging
          const existingProjectResult = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          const existingProject = existingProjectResult[0];
          if (!existingProject) {
            return json({ error: "Project not found" }, { status: 404 });
          }

          const body = await request.json();
          const parsed = updateProjectSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify client exists if changing
          if (parsed.data.clientId) {
            const clientExists = await db
              .select({ id: clients.id })
              .from(clients)
              .where(eq(clients.id, parsed.data.clientId))
              .limit(1);

            if (clientExists.length === 0) {
              return json({ error: "Client not found" }, { status: 404 });
            }
          }

          // Verify manager exists if changing
          if (parsed.data.managerId) {
            const managerExists = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, parsed.data.managerId))
              .limit(1);

            if (managerExists.length === 0) {
              return json({ error: "Manager not found" }, { status: 404 });
            }
          }

          // Build update data
          const updateData: Record<string, unknown> = {
            updatedAt: Math.floor(Date.now() / 1000),
          };

          if (parsed.data.clientId !== undefined)
            updateData.clientId = parsed.data.clientId;
          if (parsed.data.name !== undefined)
            updateData.name = parsed.data.name;
          if (parsed.data.description !== undefined)
            updateData.description = parsed.data.description;
          if (parsed.data.status !== undefined)
            updateData.status = parsed.data.status;
          if (parsed.data.priority !== undefined)
            updateData.priority = parsed.data.priority;
          if (parsed.data.startDate !== undefined) {
            updateData.startDate = parsed.data.startDate
              ? new Date(parsed.data.startDate)
              : null;
          }
          if (parsed.data.endDate !== undefined) {
            updateData.endDate = parsed.data.endDate
              ? new Date(parsed.data.endDate)
              : null;
          }
          if (parsed.data.managerId !== undefined)
            updateData.managerId = parsed.data.managerId;

          const result = await db
            .update(projects)
            .set(updateData)
            .where(eq(projects.id, projectId))
            .returning();

          const updatedProject = result[0];

          // Build changes for activity log
          const changes: Record<string, { from: unknown; to: unknown }> = {};
          if (
            parsed.data.name !== undefined &&
            parsed.data.name !== existingProject.name
          ) {
            changes.name = { from: existingProject.name, to: parsed.data.name };
          }
          if (
            parsed.data.status !== undefined &&
            parsed.data.status !== existingProject.status
          ) {
            changes.status = {
              from: existingProject.status,
              to: parsed.data.status,
            };
          }
          if (
            parsed.data.priority !== undefined &&
            parsed.data.priority !== existingProject.priority
          ) {
            changes.priority = {
              from: existingProject.priority,
              to: parsed.data.priority,
            };
          }

          // Log activity if there are changes
          if (Object.keys(changes).length > 0) {
            await logProjectUpdated(auth.user.id, projectId, changes);
          }

          return json({ data: updatedProject });
        } catch (error) {
          console.error("[PUT /api/projects/:projectId] Error:", error);
          return json({ error: "Failed to update project" }, { status: 500 });
        }
      },
    },
  },
});
