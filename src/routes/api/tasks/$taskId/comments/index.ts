/**
 * Task Comments API Routes
 * GET /api/tasks/:taskId/comments - List comments for a task
 * POST /api/tasks/:taskId/comments - Create a new comment with mention parsing
 *
 * Requirements:
 * - 8.1: Store comment message, mentions, and attachments with timestamps
 * - 8.2: Parse @username mentions and create notifications for mentioned users
 * - 8.3: Notify task assignee and reporter if they are not the comment author
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  comments,
  tasks,
  projects,
  projectMembers,
  users,
  notifications,
  type NewComment,
  type NewNotification,
} from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from '@/lib/auth/middleware';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Zod schema for creating a comment
const createCommentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  attachments: z.array(z.string().url()).optional().nullable(),
});

/**
 * Parse @mentions from comment message
 * Returns array of usernames mentioned
 */
function parseMentions(message: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = message.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))]; // Remove @ and dedupe
}

/**
 * Helper to check if user has access to a task's project
 */
async function hasTaskAccess(
  userId: string,
  userRole: string,
  projectId: string
): Promise<boolean> {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
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

export const Route = createFileRoute('/api/tasks/$taskId/comments/')({
  server: {
    handlers: {
      /**
       * GET /api/tasks/:taskId/comments
       * List comments for a task
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { taskId } = params;

          // Fetch task to verify it exists and get project ID
          const taskResult = await db
            .select({ id: tasks.id, projectId: tasks.projectId })
            .from(tasks)
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

          // Fetch comments with user info
          const commentList = await db
            .select({
              id: comments.id,
              taskId: comments.taskId,
              userId: comments.userId,
              message: comments.message,
              mentions: comments.mentions,
              attachments: comments.attachments,
              isEdited: comments.isEdited,
              createdAt: comments.createdAt,
              updatedAt: comments.updatedAt,
              userName: users.name,
              userEmail: users.email,
              userAvatarUrl: users.avatarUrl,
            })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .where(eq(comments.taskId, taskId))
            .orderBy(desc(comments.createdAt));

          // Transform to include user object
          const commentsWithUser = commentList.map((comment) => ({
            id: comment.id,
            taskId: comment.taskId,
            userId: comment.userId,
            message: comment.message,
            mentions: comment.mentions,
            attachments: comment.attachments,
            isEdited: comment.isEdited,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            user: {
              id: comment.userId,
              name: comment.userName,
              email: comment.userEmail,
              avatarUrl: comment.userAvatarUrl,
            },
          }));

          return json({ data: commentsWithUser });
        } catch (error) {
          console.error('[GET /api/tasks/:taskId/comments] Error:', error);
          return json({ error: 'Failed to fetch comments' }, { status: 500 });
        }
      },

      /**
       * POST /api/tasks/:taskId/comments
       * Create a new comment with mention parsing
       */
      POST: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // GUEST users cannot create comments
        if (auth.user.role === 'GUEST') {
          return json({ error: 'Access denied' }, { status: 403 });
        }

        try {
          const { taskId } = params;

          // Fetch task to verify it exists and get project ID, assignee, reporter
          const taskResult = await db
            .select({
              id: tasks.id,
              projectId: tasks.projectId,
              assigneeId: tasks.assigneeId,
              reporterId: tasks.reporterId,
              title: tasks.title,
            })
            .from(tasks)
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

          const body = await request.json();
          const parsed = createCommentSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Parse @mentions from message (Requirement 8.2)
          const mentionedUsernames = parseMentions(parsed.data.message);

          // Resolve usernames to user IDs
          let mentionedUserIds: string[] = [];
          if (mentionedUsernames.length > 0) {
            // Find users by name (case-insensitive match)
            const mentionedUsers = await db
              .select({ id: users.id, name: users.name })
              .from(users);

            mentionedUserIds = mentionedUsers
              .filter((u) =>
                mentionedUsernames.some(
                  (username) => u.name.toLowerCase().replace(/\s+/g, '') === username.toLowerCase()
                )
              )
              .map((u) => u.id);
          }

          const commentData: NewComment = {
            id: randomUUID(),
            taskId,
            userId: auth.user.id,
            message: parsed.data.message,
            mentions: mentionedUserIds.length > 0 ? mentionedUserIds : null,
            attachments: parsed.data.attachments || null,
            isEdited: false,
          };

          const result = await db.insert(comments).values(commentData).returning();
          const newComment = result[0]!;

          // Create notifications (Requirements 8.2, 8.3)
          const notificationsToCreate: NewNotification[] = [];
          const notifiedUserIds = new Set<string>();

          // Notify mentioned users (Requirement 8.2)
          for (const mentionedUserId of mentionedUserIds) {
            if (mentionedUserId !== auth.user.id && !notifiedUserIds.has(mentionedUserId)) {
              notificationsToCreate.push({
                id: randomUUID(),
                userId: mentionedUserId,
                type: 'MENTIONED',
                title: 'You were mentioned in a comment',
                message: `${auth.user.name} mentioned you in a comment on task: ${task.title}`,
                data: JSON.stringify({
                  entityType: 'COMMENT',
                  entityId: newComment.id,
                  taskId: task.id,
                  projectId: task.projectId,
                  commentAuthor: auth.user.id,
                }),
              });
              notifiedUserIds.add(mentionedUserId);
            }
          }

          // Notify task assignee if not the comment author (Requirement 8.3)
          if (task.assigneeId && task.assigneeId !== auth.user.id && !notifiedUserIds.has(task.assigneeId)) {
            notificationsToCreate.push({
              id: randomUUID(),
              userId: task.assigneeId,
              type: 'COMMENT_ADDED',
              title: 'New comment on your task',
              message: `${auth.user.name} commented on task: ${task.title}`,
              data: JSON.stringify({
                entityType: 'COMMENT',
                entityId: newComment.id,
                taskId: task.id,
                projectId: task.projectId,
                commentAuthor: auth.user.id,
              }),
            });
            notifiedUserIds.add(task.assigneeId);
          }

          // Notify task reporter if not the comment author (Requirement 8.3)
          if (task.reporterId !== auth.user.id && !notifiedUserIds.has(task.reporterId)) {
            notificationsToCreate.push({
              id: randomUUID(),
              userId: task.reporterId,
              type: 'COMMENT_ADDED',
              title: 'New comment on a task you reported',
              message: `${auth.user.name} commented on task: ${task.title}`,
              data: JSON.stringify({
                entityType: 'COMMENT',
                entityId: newComment.id,
                taskId: task.id,
                projectId: task.projectId,
                commentAuthor: auth.user.id,
              }),
            });
            notifiedUserIds.add(task.reporterId);
          }

          // Insert all notifications
          if (notificationsToCreate.length > 0) {
            await db.insert(notifications).values(notificationsToCreate);
          }

          // Fetch user info for response
          const userResult = await db
            .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
            .from(users)
            .where(eq(users.id, auth.user.id))
            .limit(1);

          const commentWithUser = {
            ...newComment,
            user: userResult[0] || null,
          };

          return json({ data: commentWithUser, notificationsCreated: notificationsToCreate.length }, { status: 201 });
        } catch (error) {
          console.error('[POST /api/tasks/:taskId/comments] Error:', error);
          return json({ error: 'Failed to create comment' }, { status: 500 });
        }
      },
    },
  },
});
