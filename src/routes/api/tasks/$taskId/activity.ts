/**
 * Task Activity Log API Routes
 * GET /api/tasks/:taskId/activity - Get activity for a specific task
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityLogs,
  users,
  tasks,
  projects,
  projectMembers,
} from "@/lib/db/schema";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
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

export const Route = createFileRoute("/api/tasks/$taskId/activity")({
  server: {
    handlers: {
      /**
       * GET /api/tasks/:taskId/activity
       * Get activity logs for a specific task
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const { taskId } = params;
          const url = new URL(request.url);

          const parsed = querySchema.safeParse({
            limit: url.searchParams.get("limit") || "20",
            offset: url.searchParams.get("offset") || "0",
          });

          if (!parsed.success) {
            return json({ error: "Invalid query parameters" }, { status: 400 });
          }

          // Verify task exists and get projectId
          const taskResult = await db
            .select({ id: tasks.id, projectId: tasks.projectId })
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);

          const task = taskResult[0];
          if (!task) {
            return json({ error: "Task not found" }, { status: 404 });
          }

          // Check project access
          const hasAccess = await hasTaskAccess(
            auth.user.id,
            auth.user.role,
            task.projectId
          );
          if (!hasAccess) {
            return json({ error: "Access denied" }, { status: 403 });
          }

          const { limit, offset } = parsed.data;

          // Get activities for this task
          const activityList = await db
            .select({
              id: activityLogs.id,
              actorId: activityLogs.actorId,
              entityType: activityLogs.entityType,
              entityId: activityLogs.entityId,
              action: activityLogs.action,
              metadata: activityLogs.metadata,
              createdAt: activityLogs.createdAt,
              actorName: users.name,
              actorEmail: users.email,
              actorAvatarUrl: users.avatarUrl,
            })
            .from(activityLogs)
            .leftJoin(users, eq(activityLogs.actorId, users.id))
            .where(
              and(
                eq(activityLogs.entityType, "TASK"),
                eq(activityLogs.entityId, taskId)
              )
            )
            .orderBy(desc(activityLogs.createdAt))
            .limit(limit)
            .offset(offset);

          // Parse metadata JSON
          const activities = activityList.map((activity) => ({
            ...activity,
            metadata: activity.metadata
              ? JSON.parse(activity.metadata as string)
              : null,
          }));

          return json({ data: activities });
        } catch (error) {
          console.error("[GET /api/tasks/:taskId/activity] Error:", error);
          return json(
            { error: "Failed to fetch activity logs" },
            { status: 500 }
          );
        }
      },
    },
  },
});
