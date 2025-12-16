/**
 * Hook for fetching comments for a task
 * Requirements: 8.1
 */
import { useQuery } from '@tanstack/react-query';
import { fetchComments } from '../api';

export const commentsQueryKey = (taskId: string) => ['comments', taskId] as const;

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentsQueryKey(taskId),
    queryFn: () => fetchComments(taskId),
    enabled: !!taskId,
  });
}
