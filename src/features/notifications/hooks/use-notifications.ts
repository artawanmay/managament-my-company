/**
 * Hook for fetching notifications for current user
 * Requirements: 9.3, 9.4
 */
import { useQuery } from "@tanstack/react-query";
import { fetchNotifications } from "../api";

export const notificationsQueryKey = (params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) => ["notifications", params] as const;

export function useNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: notificationsQueryKey({
      limit: params?.limit,
      offset: params?.offset,
      unreadOnly: params?.unreadOnly,
    }),
    queryFn: () =>
      fetchNotifications({
        limit: params?.limit,
        offset: params?.offset,
        unreadOnly: params?.unreadOnly,
      }),
    enabled: params?.enabled !== false,
    // Refetch every 30 seconds for near-realtime updates
    // This will be replaced with SSE in Phase 9
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
