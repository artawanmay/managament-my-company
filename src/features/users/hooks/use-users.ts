/**
 * Hook for fetching users list
 * Requirements: 2.2, 2.3
 */
import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '../api';
import type { UserListParams } from '../types';

export const usersQueryKey = (params: UserListParams = {}) => ['users', params] as const;

export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: usersQueryKey(params),
    queryFn: () => fetchUsers(params),
  });
}
