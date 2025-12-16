/**
 * Hook for updating a user's role
 * Requirements: 2.2, 2.3
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserRole } from '../api';
import type { UpdateUserRoleInput } from '../types';
import { useSession } from '@/features/auth/hooks';

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserRoleInput }) => {
      if (!csrfToken) {
        throw new Error('Not authenticated');
      }
      return updateUserRole(userId, data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate users list and specific user
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    },
  });
}
