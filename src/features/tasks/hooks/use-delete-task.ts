/**
 * useDeleteTask mutation hook
 * Requirements: 5.1
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTask } from '../api';
import { tasksQueryKey } from './use-tasks';
import { taskQueryKey } from './use-task';
import { useSession } from '@/features/auth/hooks';

interface DeleteTaskParams {
  taskId: string;
  projectId?: string;
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ taskId }: DeleteTaskParams) => {
      if (!csrfToken) {
        throw new Error('No CSRF token available');
      }
      return deleteTask(taskId, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific task
      queryClient.invalidateQueries({ queryKey: taskQueryKey(variables.taskId) });
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: tasksQueryKey() });
      // Also invalidate project-specific tasks
      if (variables.projectId) {
        queryClient.invalidateQueries({ 
          queryKey: tasksQueryKey({ projectId: variables.projectId }) 
        });
      }
    },
  });
}
