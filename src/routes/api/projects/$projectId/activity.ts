/**
 * Project Activity Log API Routes
 * GET /api/projects/:projectId/activity - Get activity for a specific project
 *
 * Requirements:
 * - 10.2: Display chronological activity for a project
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLogs, users, projects } from '@/lib/db/schema';
import {
  requireAuth,
  handleAuthError,
  requireProjectAccess,
  handleProjectAccessError,
} from '@/lib/auth/middleware';

export const Route = createFileRoute('/api/projects/$projectId/activity')({
  server: {
    handlers: {
      /**
       * GET /api/projects/:projectId/activity
       * Get activity for a specific project
       * Requirement 10.2
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { projectId } = params;

          // Check project access
          const accessCheck = await requireProjectAccess(auth.user, projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Verify project exists
          const projectExists = await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          if (projectExists.length === 0) {
            return json({ error: 'Project not found' }, { status: 404 });
          }

          // Parse query params for pagination and filtering
          const url = new URL(request.url);
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);
          const entityType = url.searchParams.get('entityType');
          const action = url.searchParams.get('action');

          // Build conditions for filtering
          // Activity related to this project includes:
          // 1. PROJECT entity type with entityId = projectId
          // 2. Other entity types (TASK, NOTE, FILE, COMMENT) with projectId in metadata
          const projectCondition = or(
            and(
              eq(activityLogs.entityType, 'PROJECT'),
              eq(activityLogs.entityId, projectId)
            ),
            sql`json_extract(${activityLogs.metadata}, '$.projectId') = ${projectId}`
          );

          const conditions = [projectCondition];

          if (entityType) {
            conditions.push(eq(activityLogs.entityType, entityType as 'CLIENT' | 'PROJECT' | 'TASK' | 'NOTE' | 'FILE' | 'COMMENT' | 'USER'));
          }
          if (action) {
            conditions.push(eq(activityLogs.action, action as 'CREATED' | 'UPDATED' | 'DELETED' | 'MOVED' | 'ARCHIVED'));
          }

          // Fetch activity for this project
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
            .where(and(...conditions))
            .orderBy(desc(activityLogs.createdAt))
            .limit(limit)
            .offset(offset);

          // Parse JSON metadata for each activity
          const activitiesWithParsedMetadata = activityList.map((a) => ({
            ...a,
            metadata: a.metadata ? (typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata) : null,
          }));

          return json({
            data: activitiesWithParsedMetadata,
            projectId,
            projectName: projectExists[0]!.name,
            pagination: {
              limit,
              offset,
              hasMore: activityList.length === limit,
            },
          });
        } catch (error) {
          console.error('[GET /api/projects/:projectId/activity] Error:', error);
          return json({ error: 'Failed to fetch project activity' }, { status: 500 });
        }
      },
    },
  },
});
