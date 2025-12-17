/**
 * Tag Attach API Route
 * POST /api/tags/:tagId/attach - Attach tag to entity
 *
 * Requirements:
 * - 14.2: Attach tag to entity with unique constraint
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tags,
  taggables,
  taggableTypeValues,
  tasks,
  projects,
  notes,
} from "@/lib/db/schema";
import { requireAuthWithCsrf, handleAuthError } from "@/lib/auth/middleware";
import { canAccessProject, canAccessNote } from "@/lib/auth/permissions";
import { z } from "zod";
import { randomUUID } from "crypto";

// Zod schema for attaching a tag
const attachTagSchema = z.object({
  taggableType: z.enum(taggableTypeValues),
  taggableId: z.string().uuid("Invalid entity ID"),
});

export const Route = createFileRoute("/api/tags/$tagId/attach")({
  server: {
    handlers: {
      /**
       * POST /api/tags/:tagId/attach
       * Attach tag to entity
       */
      POST: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // GUEST users cannot attach tags
        if (auth.user.role === "GUEST") {
          return json({ error: "Access denied" }, { status: 403 });
        }

        try {
          const { tagId } = params;

          // Check if tag exists
          const tagResult = await db
            .select()
            .from(tags)
            .where(eq(tags.id, tagId))
            .limit(1);

          if (tagResult.length === 0) {
            return json({ error: "Tag not found" }, { status: 404 });
          }

          const body = await request.json();
          const parsed = attachTagSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { taggableType, taggableId } = parsed.data;

          // Verify entity exists and user has access
          if (taggableType === "TASK") {
            const taskResult = await db
              .select({ id: tasks.id, projectId: tasks.projectId })
              .from(tasks)
              .where(eq(tasks.id, taggableId))
              .limit(1);

            if (taskResult.length === 0) {
              return json({ error: "Task not found" }, { status: 404 });
            }

            const hasAccess = await canAccessProject(
              auth.user,
              taskResult[0]!.projectId
            );
            if (!hasAccess) {
              return json(
                { error: "Access denied to this task" },
                { status: 403 }
              );
            }
          } else if (taggableType === "PROJECT") {
            const projectResult = await db
              .select({ id: projects.id })
              .from(projects)
              .where(eq(projects.id, taggableId))
              .limit(1);

            if (projectResult.length === 0) {
              return json({ error: "Project not found" }, { status: 404 });
            }

            const hasAccess = await canAccessProject(auth.user, taggableId);
            if (!hasAccess) {
              return json(
                { error: "Access denied to this project" },
                { status: 403 }
              );
            }
          } else if (taggableType === "NOTE") {
            const noteResult = await db
              .select({ id: notes.id })
              .from(notes)
              .where(eq(notes.id, taggableId))
              .limit(1);

            if (noteResult.length === 0) {
              return json({ error: "Note not found" }, { status: 404 });
            }

            const hasAccess = await canAccessNote(auth.user, taggableId);
            if (!hasAccess) {
              return json(
                { error: "Access denied to this note" },
                { status: 403 }
              );
            }
          }

          // Check if tag is already attached (for idempotency)
          const existingTaggable = await db
            .select()
            .from(taggables)
            .where(
              and(
                eq(taggables.tagId, tagId),
                eq(taggables.taggableType, taggableType),
                eq(taggables.taggableId, taggableId)
              )
            )
            .limit(1);

          if (existingTaggable.length > 0) {
            // Return existing taggable for idempotency
            return json({
              data: existingTaggable[0],
              message: "Tag already attached",
            });
          }

          // Create the taggable association
          const taggableData = {
            id: randomUUID(),
            tagId,
            taggableType,
            taggableId,
          };

          const result = await db
            .insert(taggables)
            .values(taggableData)
            .returning();
          const newTaggable = result[0];

          return json({ data: newTaggable }, { status: 201 });
        } catch (error) {
          // Check for unique constraint violation (shouldn't happen due to idempotency check above)
          if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
          ) {
            return json(
              { error: "Tag is already attached to this entity" },
              { status: 409 }
            );
          }
          console.error("[POST /api/tags/:tagId/attach] Error:", error);
          return json({ error: "Failed to attach tag" }, { status: 500 });
        }
      },
    },
  },
});
