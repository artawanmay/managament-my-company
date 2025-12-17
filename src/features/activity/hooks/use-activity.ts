/**
 * Hook for fetching global activity
 */
import { useQuery } from "@tanstack/react-query";
import { fetchActivity, type FetchActivityParams } from "../api";

export function useActivity(params: FetchActivityParams = {}) {
  return useQuery({
    queryKey: ["activity", params],
    queryFn: () => fetchActivity(params),
  });
}
