/**
 * Hook for fetching project-specific activity
 */
import { useQuery } from "@tanstack/react-query";
import { fetchProjectActivity, type FetchActivityParams } from "../api";

export function useProjectActivity(
  projectId: string,
  params: FetchActivityParams = {}
) {
  return useQuery({
    queryKey: ["project-activity", projectId, params],
    queryFn: () => fetchProjectActivity(projectId, params),
    enabled: !!projectId,
  });
}
