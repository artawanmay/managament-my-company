/**
 * useArchiveProject mutation hook
 * Requirements: 4.6
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { archiveProject } from "../api";
import { projectsQueryKey } from "./use-projects";
import { projectQueryKey } from "./use-project";
import { useSession } from "@/features/auth/hooks";

export function useArchiveProject(projectId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: () => {
      if (!csrfToken) {
        throw new Error("No CSRF token available");
      }
      return archiveProject(projectId, csrfToken);
    },
    onSuccess: () => {
      // Invalidate both list and single project queries
      queryClient.invalidateQueries({ queryKey: projectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
    },
  });
}
