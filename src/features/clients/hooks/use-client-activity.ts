/**
 * Hook for fetching client activity logs
 */
import { useQuery } from '@tanstack/react-query';

export interface ActivityLog {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
}

async function fetchClientActivity(clientId: string, limit = 20): Promise<{ data: ActivityLog[] }> {
  const response = await fetch(`/api/clients/${clientId}/activity?limit=${limit}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch activity logs');
  }

  return response.json();
}

export function useClientActivity(clientId: string, limit = 20) {
  return useQuery({
    queryKey: ['client-activity', clientId, limit],
    queryFn: () => fetchClientActivity(clientId, limit),
    enabled: !!clientId,
  });
}
