/**
 * useProject hook for fetching single project
 * Requirements: 4.3
 */
import { useQuery } from "@tanstack/react-query";
import { fetchProject } from "../api";

export const projectQueryKey = (projectId: string) => ["project", projectId];

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectQueryKey(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: !!projectId,
  });
}
