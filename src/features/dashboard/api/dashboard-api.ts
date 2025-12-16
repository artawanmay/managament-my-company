/**
 * Dashboard API
 * Functions for fetching dashboard data
 */
import type { DashboardResponse } from '../types';

const API_BASE = '/api/dashboard';

/**
 * Fetch dashboard summary data
 */
export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch(API_BASE, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch dashboard data' }));
    throw new Error(error.error || 'Failed to fetch dashboard data');
  }

  return response.json();
}
