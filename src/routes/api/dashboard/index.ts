/**
 * Dashboard API Routes
 * GET /api/dashboard - Get summary stats for dashboard
 *
 * Requirements:
 * - 15.1: Display summary cards for active clients, projects by status, tasks by status, and overdue tasks
 * - 15.2: Show tasks by status distribution and overdue tasks per project
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, sql, ne, and, lt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, projects, tasks, projectMembers } from "@/lib/db/schema";
import {
  requireAuth,
  requireRole,
  handleAuthError,
  handleRoleError,
} from "@/lib/auth/middleware";

export const Route = createFileRoute("/api/dashboard/")({
  server: {
    handlers: {
      /**
       * GET /api/dashboard
       * Get summary statistics for the dashboard
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least MEMBER role to view dashboard
        const roleCheck = requireRole(auth.user, "MEMBER");
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const now = new Date();

          // Get accessible project IDs for the user
          let accessibleProjectIds: string[] = [];
          const isAdmin = auth.user.role === "SUPER_ADMIN";

          if (!isAdmin) {
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
          }

          // Get client counts (only for admin users)
          const clientCounts = {
            total: 0,
            active: 0,
            inactive: 0,
            prospect: 0,
          };

          if (isAdmin) {
            const clientStats = await db
              .select({
                status: clients.status,
                count: sql<number>`count(*)`,
              })
              .from(clients)
              .groupBy(clients.status);

            for (const stat of clientStats) {
              clientCounts.total += stat.count;
              if (stat.status === "ACTIVE") clientCounts.active = stat.count;
              if (stat.status === "INACTIVE")
                clientCounts.inactive = stat.count;
              if (stat.status === "PROSPECT")
                clientCounts.prospect = stat.count;
            }
          }

          // Get project counts by status
          const projectCounts = {
            total: 0,
            planning: 0,
            active: 0,
            onHold: 0,
            completed: 0,
            archived: 0,
          };

          if (isAdmin) {
            const projectStats = await db
              .select({
                status: projects.status,
                count: sql<number>`count(*)`,
              })
              .from(projects)
              .groupBy(projects.status);

            for (const stat of projectStats) {
              projectCounts.total += stat.count;
              if (stat.status === "PLANNING")
                projectCounts.planning = stat.count;
              if (stat.status === "ACTIVE") projectCounts.active = stat.count;
              if (stat.status === "ON_HOLD") projectCounts.onHold = stat.count;
              if (stat.status === "COMPLETED")
                projectCounts.completed = stat.count;
              if (stat.status === "ARCHIVED")
                projectCounts.archived = stat.count;
            }
          } else if (accessibleProjectIds.length > 0) {
            const projectStats = await db
              .select({
                status: projects.status,
                count: sql<number>`count(*)`,
              })
              .from(projects)
              .where(inArray(projects.id, accessibleProjectIds))
              .groupBy(projects.status);

            for (const stat of projectStats) {
              projectCounts.total += stat.count;
              if (stat.status === "PLANNING")
                projectCounts.planning = stat.count;
              if (stat.status === "ACTIVE") projectCounts.active = stat.count;
              if (stat.status === "ON_HOLD") projectCounts.onHold = stat.count;
              if (stat.status === "COMPLETED")
                projectCounts.completed = stat.count;
              if (stat.status === "ARCHIVED")
                projectCounts.archived = stat.count;
            }
          }

          // Get task counts by status
          const taskCounts = {
            total: 0,
            backlog: 0,
            todo: 0,
            inProgress: 0,
            inReview: 0,
            changesRequested: 0,
            done: 0,
          };

          if (isAdmin) {
            const taskStats = await db
              .select({
                status: tasks.status,
                count: sql<number>`count(*)`,
              })
              .from(tasks)
              .groupBy(tasks.status);

            for (const stat of taskStats) {
              taskCounts.total += stat.count;
              if (stat.status === "BACKLOG") taskCounts.backlog = stat.count;
              if (stat.status === "TODO") taskCounts.todo = stat.count;
              if (stat.status === "IN_PROGRESS")
                taskCounts.inProgress = stat.count;
              if (stat.status === "IN_REVIEW") taskCounts.inReview = stat.count;
              if (stat.status === "CHANGES_REQUESTED")
                taskCounts.changesRequested = stat.count;
              if (stat.status === "DONE") taskCounts.done = stat.count;
            }
          } else if (accessibleProjectIds.length > 0) {
            const taskStats = await db
              .select({
                status: tasks.status,
                count: sql<number>`count(*)`,
              })
              .from(tasks)
              .where(inArray(tasks.projectId, accessibleProjectIds))
              .groupBy(tasks.status);

            for (const stat of taskStats) {
              taskCounts.total += stat.count;
              if (stat.status === "BACKLOG") taskCounts.backlog = stat.count;
              if (stat.status === "TODO") taskCounts.todo = stat.count;
              if (stat.status === "IN_PROGRESS")
                taskCounts.inProgress = stat.count;
              if (stat.status === "IN_REVIEW") taskCounts.inReview = stat.count;
              if (stat.status === "CHANGES_REQUESTED")
                taskCounts.changesRequested = stat.count;
              if (stat.status === "DONE") taskCounts.done = stat.count;
            }
          }

          // Get overdue task count
          let overdueCount = 0;

          if (isAdmin) {
            const overdueResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(tasks)
              .where(and(lt(tasks.dueDate, now), ne(tasks.status, "DONE")));
            overdueCount = overdueResult[0]?.count ?? 0;
          } else if (accessibleProjectIds.length > 0) {
            const overdueResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(tasks)
              .where(
                and(
                  inArray(tasks.projectId, accessibleProjectIds),
                  lt(tasks.dueDate, now),
                  ne(tasks.status, "DONE")
                )
              );
            overdueCount = overdueResult[0]?.count ?? 0;
          }

          // Get overdue tasks per project (for chart)
          let overdueByProject: Array<{
            projectId: string;
            projectName: string;
            count: number;
          }> = [];

          if (isAdmin) {
            const overdueStats = await db
              .select({
                projectId: tasks.projectId,
                projectName: projects.name,
                count: sql<number>`count(*)`,
              })
              .from(tasks)
              .innerJoin(projects, eq(tasks.projectId, projects.id))
              .where(and(lt(tasks.dueDate, now), ne(tasks.status, "DONE")))
              .groupBy(tasks.projectId, projects.name);

            overdueByProject = overdueStats.map((stat) => ({
              projectId: stat.projectId,
              projectName: stat.projectName,
              count: stat.count,
            }));
          } else if (accessibleProjectIds.length > 0) {
            const overdueStats = await db
              .select({
                projectId: tasks.projectId,
                projectName: projects.name,
                count: sql<number>`count(*)`,
              })
              .from(tasks)
              .innerJoin(projects, eq(tasks.projectId, projects.id))
              .where(
                and(
                  inArray(tasks.projectId, accessibleProjectIds),
                  lt(tasks.dueDate, now),
                  ne(tasks.status, "DONE")
                )
              )
              .groupBy(tasks.projectId, projects.name);

            overdueByProject = overdueStats.map((stat) => ({
              projectId: stat.projectId,
              projectName: stat.projectName,
              count: stat.count,
            }));
          }

          return json({
            data: {
              clients: clientCounts,
              projects: projectCounts,
              tasks: taskCounts,
              overdue: {
                total: overdueCount,
                byProject: overdueByProject,
              },
            },
          });
        } catch (error) {
          console.error("[GET /api/dashboard] Error:", error);
          return json(
            { error: "Failed to fetch dashboard data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
