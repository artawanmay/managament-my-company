/**
 * useTasks hook for fetching task list
 * Requirements: 5.1, 5.2
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTasks } from '../api';
import type { TaskFilters } from '../types';

export const tasksQueryKey = (filters: TaskFilters = {}) => ['tasks', filters];

export function useTasks(filters: TaskFilters = {}) {
  // Memoize filters to prevent infinite re-renders from object reference changes
  const stableFilters = useMemo(
    () => filters,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.projectId,
      filters.status,
      filters.priority,
      filters.assigneeId,
      filters.search,
      filters.sortBy,
      filters.sortOrder,
      filters.page,
      filters.limit,
    ]
  );

  return useQuery({
    queryKey: tasksQueryKey(stableFilters),
    queryFn: () => fetchTasks(stableFilters),
  });
}
