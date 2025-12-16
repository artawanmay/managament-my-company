/**
 * Hook for creating a tag
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTag } from '../api';
import { useSession } from '@/features/auth/hooks';
import type { CreateTagInput } from '../types';

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateTagInput) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return createTag(data, csrfToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}
