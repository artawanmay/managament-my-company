/**
 * useUpdateProfile Hook - Update current user profile
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdateProfileData {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

async function updateProfile(data: UpdateProfileData) {
  const csrfToken = sessionStorage.getItem('csrf_token');
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile');
  }

  return response.json();
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}
