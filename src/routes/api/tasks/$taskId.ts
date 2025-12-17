/**
 * Single Task API Routes
 * GET /api/tasks/:taskId - Get single task
 * PUT /api/tasks/:taskId - Update task
 * DELETE /api/tasks/:taskId - Delete task
 *
 * Requirements:
 * - 5.2: Display task data
 * - 5.3: Validate input and update task record
 * - 5.4: Create notification when task is assigned
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  tasks,
  taskStatusValues,
  priorityValues,
  projects,
  projectMembers,
  users,
  notifications,
  type NewNotification,
} from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from '@/lib/auth/middleware';
import { logError } from '@/lib/logger';
import { logTaskUpdated, logTaskDeleted } from '@/lib/activity';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Zod schema for updating a task
const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(taskStatusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).optional().nullable(),
  actualHours: z.number().min(0).optional().nullable(),
  linkedNoteId: z.string().uuid('Invalid note ID').optional().nullable(),
});

/**
 * Helper to check if user has access to a task's project
 */
async function hasTaskAccess(
  userId: string,
  userRole: string,
  projectId: string
): Promise<boolean> {
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  // Check if user is project manager
  const projectResult = await db
    .select({ managerId: projects.managerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const project = projectResult[0];
  if (project && project.managerId === userId) {
    return true;
  }

  // Check if user is project member
  const memberResult = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);

  return memberResult.length > 0;
}

export const Route = createFileRoute('/api/tasks/$taskId')({
  server: {
    handlers: {
      /**
       * GET /api/tasks/:taskId
       * Get single task with details
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { taskId } = params;

          // Fetch task with related data
          const taskResult = await db
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
            })
            .from(tasks)
            .leftJoin(projects, eq(tasks.projectId, projects.id))
            .where(eq(tasks.id, taskId))
            .limit(1);

          const task = taskResult[0];

          if (!task) {
            return json({ error: 'Task not found' }, { status: 404 });
          }

          // Check project access
          const hasAccess = await hasTaskAccess(auth.user.id, auth.user.role, task.projectId);
          if (!hasAccess) {
            return json({ error: 'Access denied' }, { status: 403 });
          }

          // Fetch assignee and reporter details
          let assignee = null;
          let reporter = null;

          if (task.assigneeId) {
            const assigneeResult = await db
              .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
              .from(users)
              .where(eq(users.id, task.assigneeId))
              .limit(1);
            assignee = assigneeResult[0] || null;
          }

          const reporterResult = await db
            .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
            .from(users)
            .where(eq(users.id, task.reporterId))
            .limit(1);
          reporter = reporterResult[0] || null;

          // Add isOverdue flag
          const now = new Date();
          const isOverdue = task.dueDate && task.dueDate < now && task.status !== 'DONE';

          return json({
            data: {
              ...task,
              assignee,
              reporter,
              isOverdue,
            },
          });
        } catch (error) {
          logError('[GET /api/tasks/:taskId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to fetch task' }, { status: 500 });
        }
      },

      /**
       * PUT /api/tasks/:taskId
       * Update task
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { taskId } = params;

          // Fetch existing task with all fields for change tracking
          const existingTaskResult = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);

          if (existingTaskResult.length === 0) {
            return json({ error: 'Task not found' }, { status: 404 });
          }

          const task = existingTaskResult[0]!;

          // Check project access
          const hasAccess = await hasTaskAccess(auth.user.id, auth.user.role, task.projectId);
          if (!hasAccess) {
            return json({ error: 'Access denied' }, { status: 403 });
          }

          const body = await request.json();
          const parsed = updateTaskSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify new assignee exists if provided
          if (parsed.data.assigneeId) {
            const assigneeExists = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, parsed.data.assigneeId))
              .limit(1);

            if (assigneeExists.length === 0) {
              return json({ error: 'Assignee not found' }, { status: 404 });
            }
          }

          // Build update data
          const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
          if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
          if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
          if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
          if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId;
          if (parsed.data.dueDate !== undefined) {
            updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
          }
          if (parsed.data.estimatedHours !== undefined) updateData.estimatedHours = parsed.data.estimatedHours;
          if (parsed.data.actualHours !== undefined) updateData.actualHours = parsed.data.actualHours;
          if (parsed.data.linkedNoteId !== undefined) updateData.linkedNoteId = parsed.data.linkedNoteId;

          const result = await db
            .update(tasks)
            .set(updateData)
            .where(eq(tasks.id, taskId))
            .returning();

          const updatedTask = result[0]!;

          // Build changes for activity log
          const changes: Record<string, { from: unknown; to: unknown }> = {};
          if (parsed.data.title !== undefined && parsed.data.title !== task.title) {
            changes.title = { from: task.title, to: parsed.data.title };
          }
          if (parsed.data.status !== undefined && parsed.data.status !== task.status) {
            changes.status = { from: task.status, to: parsed.data.status };
          }
          if (parsed.data.priority !== undefined && parsed.data.priority !== task.priority) {
            changes.priority = { from: task.priority, to: parsed.data.priority };
          }
          if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== task.assigneeId) {
            changes.assigneeId = { from: task.assigneeId, to: parsed.data.assigneeId };
          }

          // Log activity if there are changes
          if (Object.keys(changes).length > 0) {
            await logTaskUpdated(auth.user.id, taskId, task.projectId, changes);
          }

          // Create notification if assignee changed (Requirement 5.4)
          if (
            parsed.data.assigneeId &&
            parsed.data.assigneeId !== task.assigneeId &&
            parsed.data.assigneeId !== auth.user.id
          ) {
            const notificationData: NewNotification = {
              id: randomUUID(),
              userId: parsed.data.assigneeId,
              type: 'TASK_ASSIGNED',
              title: 'Task Assigned to You',
              message: `You have been assigned to task: ${updatedTask.title}`,
              data: JSON.stringify({
                entityType: 'TASK',
                entityId: updatedTask.id,
                projectId: task.projectId,
                assignedBy: auth.user.id,
              }),
            };

            await db.insert(notifications).values(notificationData);
          }

          return json({ data: updatedTask });
        } catch (error) {
          logError('[PUT /api/tasks/:taskId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to update task' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/tasks/:taskId
       * Delete task
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { taskId } = params;

          // Fetch existing task
          const existingTaskResult = await db
            .select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title })
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);

          if (existingTaskResult.length === 0) {
            return json({ error: 'Task not found' }, { status: 404 });
          }

          const taskToDelete = existingTaskResult[0]!;

          // Check project access
          const hasAccess = await hasTaskAccess(auth.user.id, auth.user.role, taskToDelete.projectId);
          if (!hasAccess) {
            return json({ error: 'Access denied' }, { status: 403 });
          }

          await db.delete(tasks).where(eq(tasks.id, taskId));

          // Log activity
          await logTaskDeleted(auth.user.id, taskId, taskToDelete.title, taskToDelete.projectId);

          return json({ success: true });
        } catch (error) {
          logError('[DELETE /api/tasks/:taskId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to delete task' }, { status: 500 });
        }
      },
    },
  },
});
