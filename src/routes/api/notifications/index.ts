/**
 * Notifications API Routes
 * GET /api/notifications - List notifications for current user
 * PUT /api/notifications/mark-all-read - Mark all notifications as read
 *
 * Requirements:
 * - 9.1: Create notification record with type, title, message, and related data
 * - 9.4: Click notification to navigate and mark as read
 * - 9.5: Mark all as read functionality
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, desc, isNull, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from "@/lib/auth/middleware";

export const Route = createFileRoute("/api/notifications/")({
  server: {
    handlers: {
      /**
       * GET /api/notifications
       * List notifications for current user
       * Requirement 9.1, 9.3
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          // Parse query params for pagination
          const url = new URL(request.url);
          const limit = Math.min(
            parseInt(url.searchParams.get("limit") || "20", 10),
            100
          );
          const offset = parseInt(url.searchParams.get("offset") || "0", 10);
          const unreadOnly = url.searchParams.get("unreadOnly") === "true";

          // Build query conditions
          const conditions = [eq(notifications.userId, auth.user.id)];
          if (unreadOnly) {
            conditions.push(isNull(notifications.readAt));
          }

          // Fetch notifications for current user
          const notificationList = await db
            .select()
            .from(notifications)
            .where(and(...conditions))
            .orderBy(desc(notifications.createdAt))
            .limit(limit)
            .offset(offset);

          // Get unread count
          const unreadCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, auth.user.id),
                isNull(notifications.readAt)
              )
            );

          const unreadCount = Number(unreadCountResult[0]?.count ?? 0);

          // Get total count
          const totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(notifications)
            .where(eq(notifications.userId, auth.user.id));

          const totalCount = Number(totalCountResult[0]?.count ?? 0);

          // Parse JSON data field for each notification
          const notificationsWithParsedData = notificationList.map((n) => ({
            ...n,
            data: n.data
              ? typeof n.data === "string"
                ? JSON.parse(n.data)
                : n.data
              : null,
          }));

          return json({
            data: notificationsWithParsedData,
            unreadCount,
            totalCount,
            pagination: {
              limit,
              offset,
              hasMore: offset + notificationList.length < totalCount,
            },
          });
        } catch (error) {
          console.error("[GET /api/notifications] Error:", error);
          return json(
            { error: "Failed to fetch notifications" },
            { status: 500 }
          );
        }
      },

      /**
       * PUT /api/notifications/mark-all-read
       * Mark all notifications as read for current user
       * Requirement 9.5
       */
      PUT: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          // Mark all unread notifications as read
          const result = await db
            .update(notifications)
            .set({ readAt: Math.floor(Date.now() / 1000) })
            .where(
              and(
                eq(notifications.userId, auth.user.id),
                isNull(notifications.readAt)
              )
            )
            .returning({ id: notifications.id });

          return json({
            success: true,
            markedCount: result.length,
          });
        } catch (error) {
          console.error("[PUT /api/notifications/mark-all-read] Error:", error);
          return json(
            { error: "Failed to mark notifications as read" },
            { status: 500 }
          );
        }
      },
    },
  },
});
