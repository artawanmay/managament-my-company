/**
 * useUpdateProject mutation hook
 * Requirements: 4.3
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProject } from "../api";
import { projectsQueryKey } from "./use-projects";
import { projectQueryKey } from "./use-project";
import { useSession } from "@/features/auth/hooks";
import type { UpdateProjectInput } from "../types";

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: UpdateProjectInput) => {
      if (!csrfToken) {
        throw new Error("No CSRF token available");
      }
      return updateProject(projectId, data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate both list and single project queries
      queryClient.invalidateQueries({ queryKey: projectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
    },
  });
}
