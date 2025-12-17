/**
 * Hook for marking a notification as read
 * Requirement 9.4
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markNotificationAsRead } from "../api";
import { useSession } from "@/features/auth/hooks";
import type { NotificationsListResponse, Notification } from "../types";

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const session = useSession();

  return useMutation({
    mutationFn: (notificationId: string) => {
      if (!session.csrfToken) {
        throw new Error("No CSRF token available");
      }
      return markNotificationAsRead(notificationId, session.csrfToken);
    },
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      // Snapshot the previous value
      const previousData =
        queryClient.getQueriesData<NotificationsListResponse>({
          queryKey: ["notifications"],
        });

      // Optimistically update all notification queries
      queryClient.setQueriesData<NotificationsListResponse>(
        { queryKey: ["notifications"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((n: Notification) =>
              n.id === notificationId ? { ...n, readAt: new Date() } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
