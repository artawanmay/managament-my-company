/**
 * Hook for creating a comment
 * Requirements: 8.1, 8.2, 8.3
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment } from '../api';
import { commentsQueryKey } from './use-comments';
import { useSession } from '@/features/auth/hooks';
import type { CreateCommentInput } from '../types';

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateCommentInput) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return createComment(taskId, data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate comments list to refetch
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(taskId) });
    },
  });
}
