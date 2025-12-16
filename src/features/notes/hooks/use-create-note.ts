/**
 * Hook for creating a note
 * Requirements: 7.1, 7.2
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNote } from '../api';
import type { CreateNoteInput } from '../types';
import { useSession } from '@/features/auth/hooks';

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateNoteInput) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return createNote(data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate notes list to refetch
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
