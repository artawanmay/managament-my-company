/**
 * useCreateTask mutation hook
 * Requirements: 5.1
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask } from "../api";
import { tasksQueryKey } from "./use-tasks";
import { useSession } from "@/features/auth/hooks";
import type { CreateTaskInput } from "../types";

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateTaskInput) => {
      if (!csrfToken) {
        throw new Error("No CSRF token available");
      }
      return createTask(data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate tasks list to refetch
      queryClient.invalidateQueries({ queryKey: tasksQueryKey() });
      // Also invalidate project-specific tasks
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: tasksQueryKey({ projectId: variables.projectId }),
        });
      }
    },
  });
}
