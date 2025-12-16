/**
 * useTasks hook for fetching task list
 * Requirements: 5.1, 5.2
 */
import { useQuery } from '@tanstack/react-query';
import { fetchTasks } from '../api';
import type { TaskFilters } from '../types';

export const tasksQueryKey = (filters: TaskFilters = {}) => ['tasks', filters];

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: tasksQueryKey(filters),
    queryFn: () => fetchTasks(filters),
  });
}
