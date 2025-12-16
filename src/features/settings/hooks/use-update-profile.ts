/**
 * Update Profile Mutation Hook
 *
 * Requirements:
 * - 16.4: Profile update with validation
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserProfile } from '../api';
import { useSession } from '@/features/auth/hooks';
import type { UpdateProfileRequest } from '../types';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => {
      if (!csrfToken) {
        throw new Error('No CSRF token available');
      }
      return updateUserProfile(data, csrfToken);
    },
    onSuccess: (updatedProfile) => {
      // Update profile cache
      queryClient.setQueryData(['profile'], updatedProfile);
      // Invalidate session to refresh user data in header
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}
