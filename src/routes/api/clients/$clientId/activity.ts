/**
 * Client Activity Log API Routes
 * GET /api/clients/:clientId/activity - Get activity for a specific client
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLogs, users } from '@/lib/db/schema';
import { requireAuth, requireRole, handleAuthError, handleRoleError } from '@/lib/auth/middleware';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const Route = createFileRoute('/api/clients/$clientId/activity')({
  server: {
    handlers: {
      /**
       * GET /api/clients/:clientId/activity
       * Get activity logs for a specific client
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least MEMBER role
        const roleCheck = requireRole(auth.user, 'MEMBER');
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const { clientId } = params;
          const url = new URL(request.url);
          
          const parsed = querySchema.safeParse({
            limit: url.searchParams.get('limit') || '20',
            offset: url.searchParams.get('offset') || '0',
          });

          if (!parsed.success) {
            return json({ error: 'Invalid query parameters' }, { status: 400 });
          }

          const { limit, offset } = parsed.data;

          // Get activities for this client:
          // 1. Direct client activities (entityType = CLIENT, entityId = clientId)
          // 2. Activities with clientId in metadata
          const clientCondition = or(
            and(
              eq(activityLogs.entityType, 'CLIENT'),
              eq(activityLogs.entityId, clientId)
            ),
            sql`json_extract(${activityLogs.metadata}, '$.clientId') = ${clientId}`
          );

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
            .where(clientCondition)
            .orderBy(desc(activityLogs.createdAt))
            .limit(limit)
            .offset(offset);

          // Parse metadata JSON
          const activities = activityList.map((activity) => ({
            ...activity,
            metadata: activity.metadata ? JSON.parse(activity.metadata as string) : null,
          }));

          return json({ data: activities });
        } catch (error) {
          console.error('[GET /api/clients/:clientId/activity] Error:', error);
          return json({ error: 'Failed to fetch activity logs' }, { status: 500 });
        }
      },
    },
  },
});
