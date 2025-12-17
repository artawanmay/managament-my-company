/**
 * useTasks hook for fetching task list
 * Requirements: 5.1, 5.2, 5.4
 */
import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTasks } from "../api";
import type { TaskFilters } from "../types";

/**
 * Creates a stable query key for tasks queries.
 * Uses 'as const' for type safety and consistency with other hooks.
 * TanStack Query uses structural comparison for query keys.
 */
export const tasksQueryKey = (filters: TaskFilters = {}) =>
  ["tasks", filters] as const;

/**
 * Deep comparison for TaskFilters objects.
 * Returns true if both filter objects have the same values.
 */
function areFiltersEqual(a: TaskFilters, b: TaskFilters): boolean {
  // Compare all filter properties
  return (
    a.projectId === b.projectId &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.assigneeId === b.assigneeId &&
    a.search === b.search &&
    a.sortBy === b.sortBy &&
    a.sortOrder === b.sortOrder &&
    a.page === b.page &&
    a.limit === b.limit
  );
}

export function useTasks(filters: TaskFilters = {}) {
  // Use ref to store the previous stable filters
  const filtersRef = useRef<TaskFilters>(filters);

  // Memoize filters using deep comparison to prevent unnecessary re-renders
  // This ensures stable object references for query keys
  // We use individual filter properties as dependencies for fine-grained control
  const stableFilters = useMemo(() => {
    // If filters are deeply equal to the previous stable filters, return the previous reference
    if (areFiltersEqual(filters, filtersRef.current)) {
      return filtersRef.current;
    }
    // Otherwise, update the ref and return the new filters
    filtersRef.current = {
      // Only include defined properties to ensure consistent query keys
      ...(filters.projectId !== undefined && { projectId: filters.projectId }),
      ...(filters.status !== undefined && { status: filters.status }),
      ...(filters.priority !== undefined && { priority: filters.priority }),
      ...(filters.assigneeId !== undefined && {
        assigneeId: filters.assigneeId,
      }),
      ...(filters.search !== undefined && { search: filters.search }),
      ...(filters.sortBy !== undefined && { sortBy: filters.sortBy }),
      ...(filters.sortOrder !== undefined && { sortOrder: filters.sortOrder }),
      ...(filters.page !== undefined && { page: filters.page }),
      ...(filters.limit !== undefined && { limit: filters.limit }),
    };
    return filtersRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.projectId,
    filters.status,
    filters.priority,
    filters.assigneeId,
    filters.search,
    filters.sortBy,
    filters.sortOrder,
    filters.page,
    filters.limit,
  ]);

  return useQuery({
    queryKey: tasksQueryKey(stableFilters),
    queryFn: () => fetchTasks(stableFilters),
  });
}
