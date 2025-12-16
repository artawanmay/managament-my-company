/**
 * Search API Functions
 * Requirements: 11.1, 11.2, 11.3
 */

import type { SearchResponse, SearchResults } from '../types';

const API_BASE = '/api/search';

export interface SearchParams {
  q: string;
  limit?: number;
}

/**
 * Perform global search across clients, projects, tasks, and notes
 */
export async function search(params: SearchParams): Promise<SearchResults> {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.q);
  if (params.limit) {
    searchParams.set('limit', params.limit.toString());
  }

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(error.error || 'Search failed');
  }

  const result: SearchResponse = await response.json();
  return result.data;
}
