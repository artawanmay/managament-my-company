/**
 * useSession Hook
 *
 * Requirements:
 * - 1.5: Session query with TanStack Query
 * - 3.1: Side effects use proper React hooks (useEffect) with correct dependency arrays
 * - 3.2: Avoid synchronous operations that block rendering
 */
import { useEffect, useMemo } from 'react';
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

  const csrfToken = query.data?.csrfToken ?? null;

  // Update CSRF token in sessionStorage when session data changes
  // Moved to useEffect to avoid side effects during render (Requirements 3.1, 3.2)
  useEffect(() => {
    if (csrfToken) {
      sessionStorage.setItem('csrf_token', csrfToken);
    }
  }, [csrfToken]);

  // Memoize return object to prevent unnecessary re-renders in consumers
  return useMemo(
    () => ({
      user: query.data?.user ?? null,
      isAuthenticated: query.data?.authenticated ?? false,
      csrfToken,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    }),
    [query.data, csrfToken, query.isLoading, query.isError, query.error, query.refetch]
  );
}
