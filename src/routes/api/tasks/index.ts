/**
 * Tasks API Routes
 * GET /api/tasks - List tasks with filters for project, status, assignee, priority
 * POST /api/tasks - Create a new task with notification to assignee
 *
 * Requirements:
 * - 5.1: Store task information with project association
 * - 5.2: Display filterable, sortable table with task data
 * - 5.4: Create notification for assignee when task is assigned
 * - 5.5: Mark tasks as overdue when due date passes
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, like, or, desc, asc, sql, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tasks,
  taskStatusValues,
  priorityValues,
  projects,
  projectMembers,
  users,
  notifications,
  type NewTask,
  type NewNotification,
} from "@/lib/db/schema";
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from "@/lib/auth/middleware";
import { logError } from "@/lib/logger";
import { logTaskCreated } from "@/lib/activity";
import { z } from "zod";
import { randomUUID } from "crypto";

// Zod schema for creating a task
const createTaskSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(taskStatusValues).default("BACKLOG"),
  priority: z.enum(priorityValues).default("MEDIUM"),
  assigneeId: z.string().uuid("Invalid assignee ID").optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).optional().nullable(),
  linkedNoteId: z.string().uuid("Invalid note ID").optional().nullable(),
});

// Query params schema
const listQuerySchema = z.object({
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(taskStatusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  assigneeId: z.string().uuid().optional(),
  includeOverdue: z.enum(["true", "false"]).default("false"),
  sortBy: z
    .enum([
      "title",
      "status",
      "priority",
      "dueDate",
      "createdAt",
      "updatedAt",
      "order",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const Route = createFileRoute("/api/tasks/")({
  server: {
    handlers: {
      /**
       * GET /api/tasks
       * List tasks with filters
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get("search") || undefined,
            projectId: url.searchParams.get("projectId") || undefined,
            status: url.searchParams.get("status") || undefined,
            priority: url.searchParams.get("priority") || undefined,
            assigneeId: url.searchParams.get("assigneeId") || undefined,
            includeOverdue: url.searchParams.get("includeOverdue") || "false",
            sortBy: url.searchParams.get("sortBy") || "createdAt",
            sortOrder: url.searchParams.get("sortOrder") || "desc",
            page: url.searchParams.get("page") || "1",
            limit: url.searchParams.get("limit") || "20",
          };

          const parsed = listQuerySchema.safeParse(queryParams);
          if (!parsed.success) {
            return json(
              {
                error: "Invalid query parameters",
                details: parsed.error.flatten(),
              },
              { status: 400 }
            );
          }

          const {
            search,
            projectId,
            status,
            priority,
            assigneeId,
            sortBy,
            sortOrder,
            page,
            limit,
          } = parsed.data;
          const offset = (page - 1) * limit;

          // Get accessible project IDs for the user
          let accessibleProjectIds: string[] = [];

          if (auth.user.role === "SUPER_ADMIN") {
            // SUPER_ADMIN users can see all tasks
            if (projectId) {
              accessibleProjectIds = [projectId];
            } else {
              // Get all project IDs
              const allProjects = await db
                .select({ id: projects.id })
                .from(projects);
              accessibleProjectIds = allProjects.map((p) => p.id);
            }
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

            accessibleProjectIds = [
              ...new Set([...memberProjectIds, ...managedProjectIds]),
            ];

            // If specific project requested, verify access
            if (projectId) {
              if (!accessibleProjectIds.includes(projectId)) {
                return json(
                  { error: "Access denied to this project" },
                  { status: 403 }
                );
              }
              accessibleProjectIds = [projectId];
            }
          }

          if (accessibleProjectIds.length === 0) {
            return json({
              data: [],
              pagination: { page, limit, total: 0, totalPages: 0 },
            });
          }

          // Build conditions
          const conditions = [inArray(tasks.projectId, accessibleProjectIds)];

          if (search) {
            conditions.push(
              or(
                like(tasks.title, `%${search}%`),
                like(tasks.description, `%${search}%`)
              )!
            );
          }

          if (status) {
            conditions.push(eq(tasks.status, status));
          }

          if (priority) {
            conditions.push(eq(tasks.priority, priority));
          }

          if (assigneeId) {
            conditions.push(eq(tasks.assigneeId, assigneeId));
          }

          // Build sort order
          const sortColumn = {
            title: tasks.title,
            status: tasks.status,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
            createdAt: tasks.createdAt,
            updatedAt: tasks.updatedAt,
            order: tasks.order,
          }[sortBy];

          const orderFn = sortOrder === "asc" ? asc : desc;

          // Query tasks with joins
          const taskList = await db
            .select({
              id: tasks.id,
              projectId: tasks.projectId,
              title: tasks.title,
              description: tasks.description,
              status: tasks.status,
              priority: tasks.priority,
              assigneeId: tasks.assigneeId,
              reporterId: tasks.reporterId,
              dueDate: tasks.dueDate,
              estimatedHours: tasks.estimatedHours,
              actualHours: tasks.actualHours,
              linkedNoteId: tasks.linkedNoteId,
              order: tasks.order,
              createdAt: tasks.createdAt,
              updatedAt: tasks.updatedAt,
              projectName: projects.name,
              assigneeName: users.name,
            })
            .from(tasks)
            .leftJoin(projects, eq(tasks.projectId, projects.id))
            .leftJoin(users, eq(tasks.assigneeId, users.id))
            .where(and(...conditions))
            .orderBy(orderFn(sortColumn))
            .limit(limit)
            .offset(offset);

          // Add isOverdue flag to each task (Requirement 5.5)
          const now = Math.floor(Date.now() / 1000);
          const tasksWithOverdue = taskList.map((task) => ({
            ...task,
            isOverdue:
              task.dueDate && task.dueDate < now && task.status !== "DONE",
          }));

          // Get total count
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(tasks)
            .where(and(...conditions));
          const total = countResult[0]?.count ?? 0;

          return json({
            data: tasksWithOverdue,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          logError("[GET /api/tasks] Error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return json({ error: "Failed to fetch tasks" }, { status: 500 });
        }
      },

      /**
       * POST /api/tasks
       * Create a new task
       */
      POST: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const body = await request.json();
          const parsed = createTaskSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify project exists and user has access
          const projectResult = await db
            .select({ id: projects.id, managerId: projects.managerId })
            .from(projects)
            .where(eq(projects.id, parsed.data.projectId))
            .limit(1);

          if (projectResult.length === 0) {
            return json({ error: "Project not found" }, { status: 404 });
          }

          // Check project access for non-admin users
          const projectData = projectResult[0]!;
          if (auth.user.role !== "SUPER_ADMIN") {
            const isManager = projectData.managerId === auth.user.id;
            const isMember = await db
              .select({ id: projectMembers.id })
              .from(projectMembers)
              .where(
                and(
                  eq(projectMembers.projectId, parsed.data.projectId),
                  eq(projectMembers.userId, auth.user.id)
                )
              )
              .limit(1);

            if (!isManager && isMember.length === 0) {
              return json(
                { error: "Access denied to this project" },
                { status: 403 }
              );
            }
          }

          // Verify assignee exists if provided
          if (parsed.data.assigneeId) {
            const assigneeExists = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, parsed.data.assigneeId))
              .limit(1);

            if (assigneeExists.length === 0) {
              return json({ error: "Assignee not found" }, { status: 404 });
            }
          }

          // Get max order for the status column
          const maxOrderResult = await db
            .select({ maxOrder: sql<number>`max(${tasks.order})` })
            .from(tasks)
            .where(
              and(
                eq(tasks.projectId, parsed.data.projectId),
                eq(tasks.status, parsed.data.status)
              )
            );
          const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

          const taskData: NewTask = {
            id: randomUUID(),
            projectId: parsed.data.projectId,
            title: parsed.data.title,
            description: parsed.data.description || null,
            status: parsed.data.status,
            priority: parsed.data.priority,
            assigneeId: parsed.data.assigneeId || null,
            reporterId: auth.user.id,
            dueDate: parsed.data.dueDate
              ? Math.floor(new Date(parsed.data.dueDate).getTime() / 1000)
              : null,
            estimatedHours: parsed.data.estimatedHours || null,
            linkedNoteId: parsed.data.linkedNoteId || null,
            order: nextOrder,
          };

          const result = await db.insert(tasks).values(taskData).returning();
          const newTask = result[0]!;

          // Log activity
          await logTaskCreated(
            auth.user.id,
            newTask.id,
            newTask.title,
            parsed.data.projectId
          );

          // Create notification for assignee if different from creator (Requirement 5.4)
          if (
            parsed.data.assigneeId &&
            parsed.data.assigneeId !== auth.user.id
          ) {
            const notificationData: NewNotification = {
              id: randomUUID(),
              userId: parsed.data.assigneeId,
              type: "TASK_ASSIGNED",
              title: "New Task Assigned",
              message: `You have been assigned to task: ${parsed.data.title}`,
              data: JSON.stringify({
                entityType: "TASK",
                entityId: newTask.id,
                projectId: parsed.data.projectId,
                assignedBy: auth.user.id,
              }),
            };

            await db.insert(notifications).values(notificationData);
          }

          return json({ data: newTask }, { status: 201 });
        } catch (error) {
          logError("[POST /api/tasks] Error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return json({ error: "Failed to create task" }, { status: 500 });
        }
      },
    },
  },
});
