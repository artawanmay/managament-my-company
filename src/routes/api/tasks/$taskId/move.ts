/**
 * Task Move API Route
 * PUT /api/tasks/:taskId/move - Move task to different status/order
 *
 * Requirements:
 * - 6.2: Update task status when dragged to different column
 * - 6.4: Broadcast task moves to all project viewers via SSE
 * - 20.1: Realtime task updates
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, and, gt, lt, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tasks,
  taskStatusValues,
  projects,
  projectMembers,
  notifications,
  type TaskStatus,
  type NewNotification,
} from "@/lib/db/schema";
import { requireAuthWithCsrf, handleAuthError } from "@/lib/auth/middleware";
import { publishTaskEvent, broadcastToProject } from "@/lib/realtime";
import { logTaskMoved } from "@/lib/activity";
import { z } from "zod";
import { randomUUID } from "crypto";

// Zod schema for moving a task
const moveTaskSchema = z.object({
  status: z.enum(taskStatusValues),
  order: z.number().int().min(0),
});

/**
 * Helper to check if user has access to a task's project
 */
async function hasTaskAccess(
  userId: string,
  userRole: string,
  projectId: string
): Promise<boolean> {
  if (userRole === "SUPER_ADMIN") {
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

export const Route = createFileRoute("/api/tasks/$taskId/move")({
  server: {
    handlers: {
      /**
       * PUT /api/tasks/:taskId/move
       * Move task to different status/order (for Kanban drag-drop)
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const { taskId } = params;

          // Fetch existing task
          const existingTask = await db
            .select({
              id: tasks.id,
              projectId: tasks.projectId,
              status: tasks.status,
              order: tasks.order,
              title: tasks.title,
              assigneeId: tasks.assigneeId,
            })
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);

          if (existingTask.length === 0) {
            return json({ error: "Task not found" }, { status: 404 });
          }

          const task = existingTask[0]!;

          // Check project access
          const hasAccess = await hasTaskAccess(
            auth.user.id,
            auth.user.role,
            task.projectId
          );
          if (!hasAccess) {
            return json({ error: "Access denied" }, { status: 403 });
          }

          const body = await request.json();
          const parsed = moveTaskSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { status: newStatus, order: newOrder } = parsed.data;
          const oldStatus = task.status as TaskStatus;
          const oldOrder = task.order;

          // If status changed, we need to reorder tasks in both columns
          if (newStatus !== oldStatus) {
            // Decrease order of tasks in old column that were after this task
            await db
              .update(tasks)
              .set({ order: sql`${tasks.order} - 1` })
              .where(
                and(
                  eq(tasks.projectId, task.projectId),
                  eq(tasks.status, oldStatus),
                  gt(tasks.order, oldOrder)
                )
              );

            // Increase order of tasks in new column at and after the target position
            await db
              .update(tasks)
              .set({ order: sql`${tasks.order} + 1` })
              .where(
                and(
                  eq(tasks.projectId, task.projectId),
                  eq(tasks.status, newStatus),
                  gte(tasks.order, newOrder)
                )
              );

            // Update the task with new status and order
            const result = await db
              .update(tasks)
              .set({
                status: newStatus,
                order: newOrder,
                updatedAt: Math.floor(Date.now() / 1000),
              })
              .where(eq(tasks.id, taskId))
              .returning();

            const updatedTask = result[0]!;

            // Create notification for task move if assignee exists and is different from mover
            if (task.assigneeId && task.assigneeId !== auth.user.id) {
              const notificationData: NewNotification = {
                id: randomUUID(),
                userId: task.assigneeId,
                type: "TASK_MOVED",
                title: "Task Status Changed",
                message: `Task "${task.title}" was moved from ${oldStatus} to ${newStatus}`,
                data: JSON.stringify({
                  entityType: "TASK",
                  entityId: task.id,
                  projectId: task.projectId,
                  movedBy: auth.user.id,
                  fromStatus: oldStatus,
                  toStatus: newStatus,
                }),
              };

              await db.insert(notifications).values(notificationData);
            }

            // Broadcast task move to all project viewers (Requirement 6.4, 20.1)
            const taskEvent = {
              type: "TASK_MOVED" as const,
              taskId: task.id,
              projectId: task.projectId,
              data: {
                status: newStatus,
                previousStatus: oldStatus,
                order: newOrder,
                title: task.title,
                assigneeId: task.assigneeId,
              },
              timestamp: new Date().toISOString(),
              actorId: auth.user.id,
            };

            // Log activity for status change
            await logTaskMoved(
              auth.user.id,
              task.id,
              task.projectId,
              oldStatus,
              newStatus
            );

            // Broadcast via both Redis pub/sub and direct SSE connections
            try {
              await publishTaskEvent(task.projectId, taskEvent);
            } catch (err) {
              // Log but don't fail the request if broadcast fails
              console.error("[Task Move] Failed to publish task event:", err);
            }

            // Also broadcast directly to SSE connections (for same-server connections)
            broadcastToProject(task.projectId, "task_moved", taskEvent);

            return json({ data: updatedTask });
          } else {
            // Same column, just reorder
            if (newOrder === oldOrder) {
              // No change needed
              return json({ data: task });
            }

            if (newOrder > oldOrder) {
              // Moving down: decrease order of tasks between old and new position
              await db
                .update(tasks)
                .set({ order: sql`${tasks.order} - 1` })
                .where(
                  and(
                    eq(tasks.projectId, task.projectId),
                    eq(tasks.status, oldStatus),
                    gt(tasks.order, oldOrder),
                    lte(tasks.order, newOrder),
                    ne(tasks.id, taskId)
                  )
                );
            } else {
              // Moving up: increase order of tasks between new and old position
              await db
                .update(tasks)
                .set({ order: sql`${tasks.order} + 1` })
                .where(
                  and(
                    eq(tasks.projectId, task.projectId),
                    eq(tasks.status, oldStatus),
                    gte(tasks.order, newOrder),
                    lt(tasks.order, oldOrder),
                    ne(tasks.id, taskId)
                  )
                );
            }

            // Update the task with new order
            const result = await db
              .update(tasks)
              .set({
                order: newOrder,
                updatedAt: Math.floor(Date.now() / 1000),
              })
              .where(eq(tasks.id, taskId))
              .returning();

            const updatedTask = result[0]!;

            // Broadcast reorder event to all project viewers
            const reorderEvent = {
              type: "TASK_MOVED" as const,
              taskId: task.id,
              projectId: task.projectId,
              data: {
                status: oldStatus,
                previousStatus: oldStatus,
                order: newOrder,
                title: task.title,
                assigneeId: task.assigneeId,
              },
              timestamp: new Date().toISOString(),
              actorId: auth.user.id,
            };

            try {
              await publishTaskEvent(task.projectId, reorderEvent);
            } catch (err) {
              console.error(
                "[Task Move] Failed to publish reorder event:",
                err
              );
            }

            broadcastToProject(task.projectId, "task_moved", reorderEvent);

            return json({ data: updatedTask });
          }
        } catch (error) {
          console.error("[PUT /api/tasks/:taskId/move] Error:", error);
          return json({ error: "Failed to move task" }, { status: 500 });
        }
      },
    },
  },
});
