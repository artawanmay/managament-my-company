/**
 * Single Comment API Routes
 * PUT /api/comments/:commentId - Update comment (mark as edited)
 * DELETE /api/comments/:commentId - Delete comment
 *
 * Requirements:
 * - 8.4: Update comment message and mark as edited
 * - 8.5: Remove comment after confirmation
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  comments,
  tasks,
  projects,
  projectMembers,
} from '@/lib/db/schema';
import {
  requireAuthWithCsrf,
  handleAuthError,
} from '@/lib/auth/middleware';
import { z } from 'zod';

// Zod schema for updating a comment
const updateCommentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
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

export const Route = createFileRoute('/api/comments/$commentId')({
  server: {
    handlers: {
      /**
       * PUT /api/comments/:commentId
       * Update comment (only by author)
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { commentId } = params;

          // Fetch existing comment
          const commentResult = await db
            .select({
              id: comments.id,
              taskId: comments.taskId,
              userId: comments.userId,
            })
            .from(comments)
            .where(eq(comments.id, commentId))
            .limit(1);

          const comment = commentResult[0];
          if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
          }

          // Only the comment author can edit their comment (Requirement 8.4)
          if (comment.userId !== auth.user.id) {
            return json({ error: 'Only the comment author can edit this comment' }, { status: 403 });
          }

          // Fetch task to verify project access
          const taskResult = await db
            .select({ id: tasks.id, projectId: tasks.projectId })
            .from(tasks)
            .where(eq(tasks.id, comment.taskId))
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

          const body = await request.json();
          const parsed = updateCommentSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Update comment and mark as edited (Requirement 8.4)
          const result = await db
            .update(comments)
            .set({
              message: parsed.data.message,
              isEdited: true,
              updatedAt: new Date(),
            })
            .where(eq(comments.id, commentId))
            .returning();

          const updatedComment = result[0]!;

          return json({ data: updatedComment });
        } catch (error) {
          console.error('[PUT /api/comments/:commentId] Error:', error);
          return json({ error: 'Failed to update comment' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/comments/:commentId
       * Delete comment (by author or admin)
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { commentId } = params;

          // Fetch existing comment
          const commentResult = await db
            .select({
              id: comments.id,
              taskId: comments.taskId,
              userId: comments.userId,
            })
            .from(comments)
            .where(eq(comments.id, commentId))
            .limit(1);

          const comment = commentResult[0];
          if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
          }

          // Fetch task to verify project access
          const taskResult = await db
            .select({ id: tasks.id, projectId: tasks.projectId })
            .from(tasks)
            .where(eq(tasks.id, comment.taskId))
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

          // Only the comment author or admins can delete (Requirement 8.5)
          const isAuthor = comment.userId === auth.user.id;
          const isAdmin = auth.user.role === 'SUPER_ADMIN';

          if (!isAuthor && !isAdmin) {
            return json({ error: 'Only the comment author or SUPER_ADMIN can delete this comment' }, { status: 403 });
          }

          await db.delete(comments).where(eq(comments.id, commentId));

          return json({ success: true });
        } catch (error) {
          console.error('[DELETE /api/comments/:commentId] Error:', error);
          return json({ error: 'Failed to delete comment' }, { status: 500 });
        }
      },
    },
  },
});
