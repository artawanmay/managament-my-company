/**
 * useDashboard Hook
 * TanStack Query hook for fetching dashboard data
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../api";
import type { DashboardData } from "../types";

export const dashboardQueryKey = ["dashboard"] as const;

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: dashboardQueryKey,
    queryFn: async () => {
      const response = await fetchDashboard();
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
