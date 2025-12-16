/**
 * Hook for deleting a tag
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTag } from '../api';
import { useSession } from '@/features/auth/hooks';

export function useDeleteTag() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (tagId: string) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return deleteTag(tagId, csrfToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}
