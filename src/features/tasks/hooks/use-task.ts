/**
 * useTask hook for fetching single task
 * Requirements: 5.1
 */
import { useQuery } from '@tanstack/react-query';
import { fetchTask } from '../api';

export const taskQueryKey = (taskId: string) => ['task', taskId];

export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskQueryKey(taskId),
    queryFn: () => fetchTask(taskId),
    enabled: !!taskId,
  });
}
