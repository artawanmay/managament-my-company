/**
 * Hook for fetching tags list
 */
import { useQuery } from '@tanstack/react-query';
import { fetchTags } from '../api';

interface UseTagsParams {
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function useTags(params?: UseTagsParams) {
  return useQuery({
    queryKey: ['tags', params],
    queryFn: () => fetchTags(params),
  });
}
