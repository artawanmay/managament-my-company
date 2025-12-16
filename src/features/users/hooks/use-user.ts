/**
 * Hook for fetching a single user
 * Requirements: 2.2, 2.3
 */
import { useQuery } from '@tanstack/react-query';
import { fetchUser } from '../api';

export const userQueryKey = (userId: string) => ['user', userId] as const;

export function useUser(userId: string) {
  return useQuery({
    queryKey: userQueryKey(userId),
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
  });
}
