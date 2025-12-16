/**
 * TanStack Query Client Configuration
 * Centralized query client with error handling and retry logic
 */
import { QueryClient } from '@tanstack/react-query';
import { shouldRetry, getRetryDelay } from './errors/client';

/**
 * Create a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 1 minute
        staleTime: 60 * 1000,
        // Retry configuration with exponential backoff
        retry: (failureCount, error) => shouldRetry(failureCount, error),
        retryDelay: (attemptIndex) => getRetryDelay(attemptIndex),
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect by default (SSE handles this)
        refetchOnReconnect: false,
      },
      mutations: {
        // Don't retry mutations by default (user should retry manually)
        retry: false,
      },
    },
  });
}

/**
 * Default query client instance
 */
export const queryClient = createQueryClient();
