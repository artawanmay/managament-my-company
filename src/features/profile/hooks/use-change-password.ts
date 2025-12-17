/**
 * useChangePassword Hook - Change current user password
 */
import { useMutation } from '@tanstack/react-query';

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

async function changePassword(data: ChangePasswordData) {
  const csrfToken = sessionStorage.getItem('csrf_token');
  const response = await fetch('/api/profile/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
  }

  return response.json();
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
  });
}
