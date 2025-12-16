/**
 * Hook for fetching a single client
 * Requirements: 3.4
 */
import { useQuery } from '@tanstack/react-query';
import { fetchClient } from '../api';

export const clientQueryKey = (clientId: string) => ['client', clientId] as const;

export function useClient(clientId: string) {
  return useQuery({
    queryKey: clientQueryKey(clientId),
    queryFn: () => fetchClient(clientId),
    enabled: !!clientId,
  });
}
