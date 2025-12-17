/**
 * Notifications API functions
 * Requirements: 9.1, 9.3, 9.4, 9.5
 */
import type {
  NotificationsListResponse,
  MarkAsReadResponse,
  MarkAllAsReadResponse,
} from "../types";

/**
 * Fetch notifications for current user
 * Requirement 9.3
 */
export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  csrfToken?: string;
}): Promise<NotificationsListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.unreadOnly) searchParams.set("unreadOnly", "true");

  const url = `/api/notifications${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (params?.csrfToken) {
    headers["X-CSRF-Token"] = params.csrfToken;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to fetch notifications" }));
    throw new Error(error.error || "Failed to fetch notifications");
  }

  return response.json();
}

/**
 * Mark a single notification as read
 * Requirement 9.4
 */
export async function markNotificationAsRead(
  notificationId: string,
  csrfToken: string
): Promise<MarkAsReadResponse> {
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to mark notification as read" }));
    throw new Error(error.error || "Failed to mark notification as read");
  }

  return response.json();
}

/**
 * Mark all notifications as read
 * Requirement 9.5
 */
export async function markAllNotificationsAsRead(
  csrfToken: string
): Promise<MarkAllAsReadResponse> {
  const response = await fetch("/api/notifications", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to mark all notifications as read" }));
    throw new Error(error.error || "Failed to mark all notifications as read");
  }

  return response.json();
}
