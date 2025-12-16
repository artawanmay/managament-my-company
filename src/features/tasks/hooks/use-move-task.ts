/**
 * useMoveTask mutation hook with optimistic updates
 * Requirements: 6.2
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveTask } from '../api';
import { tasksQueryKey } from './use-tasks';
import { useSession } from '@/features/auth/hooks';
import type { MoveTaskInput, Task, TaskListResponse } from '../types';

interface MoveTaskParams {
  taskId: string;
  data: MoveTaskInput;
  projectId?: string;
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ taskId, data }: MoveTaskParams) => {
      if (!csrfToken) {
        throw new Error('No CSRF token available');
      }
      return moveTask(taskId, data, csrfToken);
    },
    // Optimistic update for smooth drag-drop experience
    onMutate: async ({ taskId, data, projectId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: tasksQueryKey() });
      if (projectId) {
        await queryClient.cancelQueries({ 
          queryKey: tasksQueryKey({ projectId }) 
        });
      }

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<TaskListResponse>(
        tasksQueryKey(projectId ? { projectId } : {})
      );

      // Optimistically update the task
      if (previousTasks) {
        queryClient.setQueryData<TaskListResponse>(
          tasksQueryKey(projectId ? { projectId } : {}),
          {
            ...previousTasks,
            data: previousTasks.data.map((task: Task) =>
              task.id === taskId
                ? { ...task, status: data.status, order: data.order }
                : task
            ),
          }
        );
      }

      return { previousTasks, projectId };
    },
    // If the mutation fails, rollback to the previous value
    onError: (_, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          tasksQueryKey(context.projectId ? { projectId: context.projectId } : {}),
          context.previousTasks
        );
      }
    },
    // Always refetch after error or success
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey() });
      if (variables.projectId) {
        queryClient.invalidateQueries({ 
          queryKey: tasksQueryKey({ projectId: variables.projectId }) 
        });
      }
    },
  });
}
