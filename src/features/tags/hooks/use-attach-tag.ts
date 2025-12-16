/**
 * Hook for attaching a tag to an entity
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachTag } from '../api';
import { useSession } from '@/features/auth/hooks';
import type { AttachTagInput } from '../types';

interface AttachTagParams {
  tagId: string;
  data: AttachTagInput;
}

export function useAttachTag() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ tagId, data }: AttachTagParams) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return attachTag(tagId, data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate tags and the entity's tags
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({
        queryKey: [variables.data.taggableType.toLowerCase(), variables.data.taggableId, 'tags'],
      });
      // Also invalidate the entity list to refresh tag display
      queryClient.invalidateQueries({
        queryKey: [variables.data.taggableType.toLowerCase() + 's'],
      });
    },
  });
}
