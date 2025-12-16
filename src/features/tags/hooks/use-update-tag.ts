/**
 * Hook for updating a tag
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTag } from '../api';
import { useSession } from '@/features/auth/hooks';
import type { UpdateTagInput } from '../types';

interface UpdateTagParams {
  tagId: string;
  data: UpdateTagInput;
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ tagId, data }: UpdateTagParams) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return updateTag(tagId, data, csrfToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}
