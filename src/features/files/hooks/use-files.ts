/**
 * Hook for fetching files list
 * Requirements: 13.2
 */
import { useQuery } from "@tanstack/react-query";
import { fetchFiles, type FilesListParams } from "../api";

export const filesQueryKey = (
  projectId: string,
  params: FilesListParams = {}
) => ["files", projectId, params] as const;

export function useFiles(projectId: string, params: FilesListParams = {}) {
  return useQuery({
    queryKey: filesQueryKey(projectId, params),
    queryFn: () => fetchFiles(projectId, params),
    enabled: !!projectId,
  });
}
