/**
 * useProjects hook for fetching project list
 * Requirements: 4.1, 4.2
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "../api";
import type { ProjectListParams } from "../types";

export const projectsQueryKey = (params: ProjectListParams = {}) => [
  "projects",
  params,
];

export function useProjects(params: ProjectListParams = {}) {
  // Memoize params to prevent infinite re-renders from object reference changes
  const stableParams = useMemo(
    () => params,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      params.clientId,
      params.status,
      params.priority,
      params.search,
      params.includeArchived,
      params.sortBy,
      params.sortOrder,
      params.page,
      params.limit,
    ]
  );

  return useQuery({
    queryKey: projectsQueryKey(stableParams),
    queryFn: () => fetchProjects(stableParams),
  });
}
