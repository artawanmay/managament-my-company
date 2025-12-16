/**
 * Notifications Realtime SSE Endpoint
 * GET /api/realtime/notifications - SSE stream for user notifications
 *
 * Requirements:
 * - 9.2: Push notifications to online users via SSE
 * - 20.2: Realtime notification updates
 */
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth, handleAuthError } from '@/lib/auth/middleware';
import {
  createSSEResponse,
  registerUserConnection,
  subscribeToNotificationEvents,
  type NotificationEvent,
} from '@/lib/realtime';

export const Route = createFileRoute('/api/realtime/notifications')({
  server: {
    handlers: {
      /**
       * GET /api/realtime/notifications
       * Establish SSE connection for realtime notification updates
       * Requirement 9.2, 20.2
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) {
          return authError ?? new Response('Unauthorized', { status: 401 });
        }

        const userId = auth.user.id;

        // Create SSE response with Redis subscription
        let unsubscribe: (() => void) | null = null;

        return createSSEResponse(
          (connection) => {
            // Register connection for direct broadcasts
            registerUserConnection(userId, connection);

            // Subscribe to Redis pub/sub for notification events
            unsubscribe = subscribeToNotificationEvents(
              userId,
              (event: NotificationEvent) => {
                // Forward the notification to the SSE client
                connection.send('notification', {
                  notificationId: event.notificationId,
                  userId: event.userId,
                  title: event.data.title,
                  message: event.data.message,
                  type: event.data.notificationType,
                  entityType: event.data.entityType,
                  entityId: event.data.entityId,
                  timestamp: event.timestamp,
                });
              }
            );

            console.log(`[SSE] User ${userId} connected to notifications`);
          },
          () => {
            // Cleanup on disconnect
            unsubscribe?.();
            console.log(`[SSE] User ${userId} disconnected from notifications`);
          }
        );
      },
    },
  },
});
