/**
 * Single Notification Read API Route
 * PUT /api/notifications/:notificationId/read - Mark notification as read
 *
 * Requirements:
 * - 9.4: Click notification to navigate and mark as read
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireAuthWithCsrf, handleAuthError } from "@/lib/auth/middleware";

export const Route = createFileRoute("/api/notifications/$notificationId/read")(
  {
    server: {
      handlers: {
        /**
         * PUT /api/notifications/:notificationId/read
         * Mark a single notification as read
         * Requirement 9.4
         */
        PUT: async ({ request, params }) => {
          // Authenticate user with CSRF protection
          const auth = await requireAuthWithCsrf(request);
          const authError = handleAuthError(auth);
          if (authError || !auth.success)
            return authError ?? new Response("Unauthorized", { status: 401 });

          try {
            const { notificationId } = params;

            // Fetch notification to verify ownership
            const notificationResult = await db
              .select()
              .from(notifications)
              .where(eq(notifications.id, notificationId))
              .limit(1);

            const notification = notificationResult[0];
            if (!notification) {
              return json({ error: "Notification not found" }, { status: 404 });
            }

            // Verify the notification belongs to the current user
            if (notification.userId !== auth.user.id) {
              return json({ error: "Access denied" }, { status: 403 });
            }

            // Mark as read if not already read
            if (!notification.readAt) {
              await db
                .update(notifications)
                .set({ readAt: new Date() })
                .where(eq(notifications.id, notificationId));
            }

            return json({
              success: true,
              data: {
                ...notification,
                readAt: notification.readAt || new Date(),
                data: notification.data
                  ? typeof notification.data === "string"
                    ? JSON.parse(notification.data)
                    : notification.data
                  : null,
              },
            });
          } catch (error) {
            console.error(
              "[PUT /api/notifications/:notificationId/read] Error:",
              error
            );
            return json(
              { error: "Failed to mark notification as read" },
              { status: 500 }
            );
          }
        },
      },
    },
  }
);
