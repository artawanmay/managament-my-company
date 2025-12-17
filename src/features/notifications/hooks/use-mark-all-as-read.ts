/**
 * Hook for marking all notifications as read
 * Requirement 9.5
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markAllNotificationsAsRead } from "../api";
import { useSession } from "@/features/auth/hooks";
import type { NotificationsListResponse, Notification } from "../types";

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const session = useSession();

  return useMutation({
    mutationFn: () => {
      if (!session.csrfToken) {
        throw new Error("No CSRF token available");
      }
      return markAllNotificationsAsRead(session.csrfToken);
    },
    onMutate: async () => {
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
            data: old.data.map((n: Notification) => ({
              ...n,
              readAt: n.readAt || new Date(),
            })),
            unreadCount: 0,
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
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
