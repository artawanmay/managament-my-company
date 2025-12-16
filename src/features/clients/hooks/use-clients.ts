/**
 * Hook for fetching clients list
 * Requirements: 3.1, 3.2, 3.3
 */
import { useQuery } from '@tanstack/react-query';
import { fetchClients } from '../api';
import type { ClientListParams } from '../types';

export const clientsQueryKey = (params: ClientListParams = {}) => ['clients', params] as const;

export function useClients(params: ClientListParams = {}) {
  return useQuery({
    queryKey: clientsQueryKey(params),
    queryFn: () => fetchClients(params),
  });
}
