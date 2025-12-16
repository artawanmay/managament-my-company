/**
 * Global Activity Log API Routes
 * GET /api/activity - Get global activity filtered by permissions
 *
 * Requirements:
 * - 10.3: Display system-wide activity filtered by permissions
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, desc, and, or, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLogs, users, projectMembers, projects } from '@/lib/db/schema';
import { requireAuth, handleAuthError } from '@/lib/auth/middleware';

export const Route = createFileRoute('/api/activity/')({
  server: {
    handlers: {
      /**
       * GET /api/activity
       * Get global activity filtered by permissions
       * Requirement 10.3
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          // Parse query params for pagination and filtering
          const url = new URL(request.url);
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);
          const entityType = url.searchParams.get('entityType');
          const action = url.searchParams.get('action');

          // SUPER_ADMIN and ADMIN can see all activity
          // Other roles can only see activity for projects they have access to
          let activityList;

          if (auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN') {
            // Build conditions for filtering
            const conditions = [];
            if (entityType) {
              conditions.push(eq(activityLogs.entityType, entityType as 'CLIENT' | 'PROJECT' | 'TASK' | 'NOTE' | 'FILE' | 'COMMENT' | 'USER'));
            }
            if (action) {
              conditions.push(eq(activityLogs.action, action as 'CREATED' | 'UPDATED' | 'DELETED' | 'MOVED' | 'ARCHIVED'));
            }

            // Fetch all activity
            activityList = await db
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
              .where(conditions.length > 0 ? and(...conditions) : undefined)
              .orderBy(desc(activityLogs.createdAt))
              .limit(limit)
              .offset(offset);
          } else {
            // Get projects the user has access to
            const userProjects = await db
              .select({ projectId: projectMembers.projectId })
              .from(projectMembers)
              .where(eq(projectMembers.userId, auth.user.id));

            const managedProjects = await db
              .select({ id: projects.id })
              .from(projects)
              .where(eq(projects.managerId, auth.user.id));

            const accessibleProjectIds = [
              ...userProjects.map((p) => p.projectId),
              ...managedProjects.map((p) => p.id),
            ];

            // Remove duplicates
            const uniqueProjectIds = [...new Set(accessibleProjectIds)];

            if (uniqueProjectIds.length === 0) {
              return json({
                data: [],
                pagination: {
                  limit,
                  offset,
                  hasMore: false,
                },
              });
            }

            // Build conditions for filtering
            // We need to filter activity that relates to accessible projects
            // This includes PROJECT entity type with matching entityId,
            // or TASK/NOTE/FILE/COMMENT with projectId in metadata
            const conditions = [];
            if (entityType) {
              conditions.push(eq(activityLogs.entityType, entityType as 'CLIENT' | 'PROJECT' | 'TASK' | 'NOTE' | 'FILE' | 'COMMENT' | 'USER'));
            }
            if (action) {
              conditions.push(eq(activityLogs.action, action as 'CREATED' | 'UPDATED' | 'DELETED' | 'MOVED' | 'ARCHIVED'));
            }

            // For non-admin users, filter by accessible projects
            // This is a simplified approach - we check if entityType is PROJECT and entityId is in accessible projects
            // or if the metadata contains a projectId that is accessible
            const projectCondition = or(
              and(
                eq(activityLogs.entityType, 'PROJECT'),
                inArray(activityLogs.entityId, uniqueProjectIds)
              ),
              // For other entity types, we need to check metadata.projectId
              // This is done via JSON extraction in SQLite
              ...uniqueProjectIds.map((projectId) =>
                sql`json_extract(${activityLogs.metadata}, '$.projectId') = ${projectId}`
              )
            );

            const allConditions = conditions.length > 0 
              ? and(projectCondition, ...conditions)
              : projectCondition;

            activityList = await db
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
              .where(allConditions)
              .orderBy(desc(activityLogs.createdAt))
              .limit(limit)
              .offset(offset);
          }

          // Parse JSON metadata for each activity
          const activitiesWithParsedMetadata = activityList.map((a) => ({
            ...a,
            metadata: a.metadata ? (typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata) : null,
          }));

          return json({
            data: activitiesWithParsedMetadata,
            pagination: {
              limit,
              offset,
              hasMore: activityList.length === limit,
            },
          });
        } catch (error) {
          console.error('[GET /api/activity] Error:', error);
          return json({ error: 'Failed to fetch activity' }, { status: 500 });
        }
      },
    },
  },
});
