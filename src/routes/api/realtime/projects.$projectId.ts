/**
 * Project Realtime SSE Endpoint
 * GET /api/realtime/projects/:projectId - SSE stream for task updates
 *
 * Requirements:
 * - 6.4: Realtime task updates via SSE
 * - 20.1: Broadcast task moves to all project viewers
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { canAccessProject } from "@/lib/auth/permissions";
import {
  createSSEResponse,
  registerProjectConnection,
  subscribeToTaskEvents,
  type TaskEvent,
} from "@/lib/realtime";

export const Route = createFileRoute("/api/realtime/projects/$projectId")({
  server: {
    handlers: {
      /**
       * GET /api/realtime/projects/:projectId
       * Establish SSE connection for realtime task updates
       * Requirement 6.4, 20.1
       */
      GET: async ({ request, params }) => {
        const { projectId } = params;

        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) {
          return authError ?? new Response("Unauthorized", { status: 401 });
        }

        // Check project access
        const hasAccess = await canAccessProject(auth.user, projectId);
        if (!hasAccess) {
          return new Response("Forbidden: No access to this project", {
            status: 403,
          });
        }

        // Create SSE response with Redis subscription
        let unsubscribe: (() => void) | null = null;

        return createSSEResponse(
          (connection) => {
            // Register connection for direct broadcasts
            registerProjectConnection(projectId, connection);

            // Subscribe to Redis pub/sub for task events
            unsubscribe = subscribeToTaskEvents(
              projectId,
              (event: TaskEvent) => {
                // Forward the event to the SSE client
                connection.send(event.type.toLowerCase(), {
                  taskId: event.taskId,
                  projectId: event.projectId,
                  data: event.data,
                  timestamp: event.timestamp,
                  actorId: event.actorId,
                });
              }
            );

            console.log(
              `[SSE] User ${auth.user.id} connected to project ${projectId}`
            );
          },
          () => {
            // Cleanup on disconnect
            unsubscribe?.();
            console.log(
              `[SSE] User ${auth.user.id} disconnected from project ${projectId}`
            );
          }
        );
      },
    },
  },
});
