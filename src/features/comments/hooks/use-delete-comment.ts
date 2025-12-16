/**
 * Hook for deleting a comment
 * Requirements: 8.5
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteComment } from '../api';
import { commentsQueryKey } from './use-comments';
import { useSession } from '@/features/auth/hooks';

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (commentId: string) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return deleteComment(commentId, csrfToken);
    },
    onSuccess: () => {
      // Invalidate comments list to refetch
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(taskId) });
    },
  });
}
