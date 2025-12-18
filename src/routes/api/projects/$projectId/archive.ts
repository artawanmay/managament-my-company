/**
 * Project Archive API Route
 * PUT /api/projects/:projectId/archive - Archive a project
 *
 * Requirements:
 * - 4.6: Archive project and hide from default views
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import {
  requireAuthWithCsrf,
  handleAuthError,
  requireProjectManagement,
  handleProjectAccessError,
} from "@/lib/auth/middleware";

export const Route = createFileRoute("/api/projects/$projectId/archive")({
  server: {
    handlers: {
      /**
       * PUT /api/projects/:projectId/archive
       * Archive a project
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

          // Check if project exists
          const existingProject = await db
            .select({ id: projects.id, status: projects.status })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          const project = existingProject[0];
          if (!project) {
            return json({ error: "Project not found" }, { status: 404 });
          }

          // Check if already archived
          if (project.status === "ARCHIVED") {
            return json(
              { error: "Project is already archived" },
              { status: 400 }
            );
          }

          // Archive the project
          const result = await db
            .update(projects)
            .set({
              status: "ARCHIVED",
              updatedAt: Math.floor(Date.now() / 1000),
            })
            .where(eq(projects.id, projectId))
            .returning();

          const archivedProject = result[0];

          return json({
            data: archivedProject,
            message: "Project archived successfully",
          });
        } catch (error) {
          console.error("[PUT /api/projects/:projectId/archive] Error:", error);
          return json({ error: "Failed to archive project" }, { status: 500 });
        }
      },
    },
  },
});
