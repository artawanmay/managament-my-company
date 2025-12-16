/**
 * Activity Log API functions
 */
import type { ActivityListResponse, ProjectActivityResponse, EntityType, Action } from '../types';

const API_BASE = '/api';

export interface FetchActivityParams {
  limit?: number;
  offset?: number;
  entityType?: EntityType;
  action?: Action;
}

/**
 * Fetch global activity (filtered by permissions)
 */
export async function fetchActivity(params: FetchActivityParams = {}): Promise<ActivityListResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.entityType) searchParams.set('entityType', params.entityType);
  if (params.action) searchParams.set('action', params.action);

  const queryString = searchParams.toString();
  const url = `${API_BASE}/activity${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch activity' }));
    throw new Error(error.error || 'Failed to fetch activity');
  }

  return response.json();
}

/**
 * Fetch activity for a specific project
 */
export async function fetchProjectActivity(
  projectId: string,
  params: FetchActivityParams = {}
): Promise<ProjectActivityResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.entityType) searchParams.set('entityType', params.entityType);
  if (params.action) searchParams.set('action', params.action);

  const queryString = searchParams.toString();
  const url = `${API_BASE}/projects/${projectId}/activity${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch project activity' }));
    throw new Error(error.error || 'Failed to fetch project activity');
  }

  return response.json();
}
