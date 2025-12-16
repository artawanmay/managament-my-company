/**
 * useLogout Hook
 *
 * Requirements:
 * - 1.4: Logout mutation with TanStack Query
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth-api';
import type { LogoutResponse } from '../types';

interface UseLogoutOptions {
  onSuccess?: (data: LogoutResponse) => void;
  onError?: (error: Error) => void;
}

export function useLogout(options?: UseLogoutOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      const csrfToken = sessionStorage.getItem('csrf_token') || '';
      return logout(csrfToken);
    },
    onSuccess: (data) => {
      if (data.success) {
        // Clear CSRF token
        sessionStorage.removeItem('csrf_token');
        // Clear all cached queries
        queryClient.clear();
        // Invalidate session query
        queryClient.invalidateQueries({ queryKey: ['session'] });
      }
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
