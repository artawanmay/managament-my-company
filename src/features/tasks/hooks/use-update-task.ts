/**
 * useUpdateTask mutation hook
 * Requirements: 5.3
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask } from "../api";
import { tasksQueryKey } from "./use-tasks";
import { taskQueryKey } from "./use-task";
import { useSession } from "@/features/auth/hooks";
import type { UpdateTaskInput } from "../types";

interface UpdateTaskParams {
  taskId: string;
  data: UpdateTaskInput;
  projectId?: string;
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ taskId, data }: UpdateTaskParams) => {
      if (!csrfToken) {
        throw new Error("No CSRF token available");
      }
      return updateTask(taskId, data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific task
      queryClient.invalidateQueries({
        queryKey: taskQueryKey(variables.taskId),
      });
      // Invalidate tasks list
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
