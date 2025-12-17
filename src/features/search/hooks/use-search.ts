/**
 * Search Hook
 * Requirements: 11.1, 11.2, 11.3, 12.2
 */

import { useQuery } from "@tanstack/react-query";
import { search } from "../api";
import type { SearchResults } from "../types";

export const searchKeys = {
  all: ["search"] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

export interface UseSearchOptions {
  query: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for performing global search with debounced query
 */
export function useSearch({
  query,
  limit = 5,
  enabled = true,
}: UseSearchOptions) {
  return useQuery<SearchResults, Error>({
    queryKey: searchKeys.query(query),
    queryFn: () => search({ q: query, limit }),
    enabled: enabled && query.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
