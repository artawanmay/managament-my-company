/**
 * useSession Hook
 *
 * Requirements:
 * - 1.5: Session query with TanStack Query
 */
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../api/auth-api';
import type { SessionResponse, User } from '../types';

interface UseSessionReturn {
  user: User | null;
  isAuthenticated: boolean;
  csrfToken: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSession(): UseSessionReturn {
  const query = useQuery<SessionResponse>({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Update CSRF token in sessionStorage when session data changes
  if (query.data?.csrfToken) {
    sessionStorage.setItem('csrf_token', query.data.csrfToken);
  }

  return {
    user: query.data?.user ?? null,
    isAuthenticated: query.data?.authenticated ?? false,
    csrfToken: query.data?.csrfToken ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
