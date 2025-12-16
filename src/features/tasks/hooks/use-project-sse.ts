/**
 * useProjectSSE hook for realtime task updates via SSE
 * Connects to project SSE endpoint and updates TanStack Query cache on events
 * Falls back to polling on connection failure
 *
 * Requirements: 6.4, 20.3, 20.4
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tasksQueryKey } from './use-tasks';
import type { Task, TaskListResponse } from '../types';
import { logDebug, logError } from '@/lib/logger';

// SSE event types from the server
interface TaskSSEEvent {
  taskId: string;
  projectId: string;
  data: {
    status?: string;
    previousStatus?: string;
    order?: number;
    title?: string;
    assigneeId?: string | null;
    [key: string]: unknown;
  };
  timestamp: string;
  actorId: string;
}

interface UseProjectSSEOptions {
  /** Project ID to subscribe to */
  projectId: string;
  /** Whether the hook is enabled */
  enabled?: boolean;
  /** Polling interval in ms when SSE fails (default: 10000) */
  pollingInterval?: number;
  /** Max reconnection attempts before falling back to polling (default: 3) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  reconnectBaseDelay?: number;
}

interface UseProjectSSEReturn {
  /** Whether SSE is currently connected */
  isConnected: boolean;
  /** Whether currently using polling fallback */
  isPolling: boolean;
  /** Last error that occurred */
  error: Error | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Manually reconnect to SSE */
  reconnect: () => void;
}

export function useProjectSSE({
  projectId,
  enabled = true,
  pollingInterval = 10000,
  maxReconnectAttempts = 3,
  reconnectBaseDelay = 1000,
}: UseProjectSSEOptions): UseProjectSSEReturn {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Update task in query cache
  const updateTaskInCache = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      // Update tasks list cache for this project
      queryClient.setQueriesData<TaskListResponse>(
        { queryKey: tasksQueryKey({ projectId }) },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((task) =>
              task.id === taskId ? { ...task, ...updates } : task
            ),
          };
        }
      );

      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: tasksQueryKey({ projectId }),
        refetchType: 'none', // Don't refetch immediately, just mark as stale
      });
    },
    [queryClient, projectId]
  );

  // Handle task created event
  const handleTaskCreated = useCallback(
    (event: TaskSSEEvent) => {
      logDebug('[SSE] Task created', { taskId: event.taskId });
      // Invalidate to fetch the new task
      queryClient.invalidateQueries({
        queryKey: tasksQueryKey({ projectId }),
      });
    },
    [queryClient, projectId]
  );

  // Handle task updated event
  const handleTaskUpdated = useCallback(
    (event: TaskSSEEvent) => {
      logDebug('[SSE] Task updated', { taskId: event.taskId, data: event.data });
      updateTaskInCache(event.taskId, event.data as Partial<Task>);
    },
    [updateTaskInCache]
  );

  // Handle task moved event (Kanban drag-drop)
  const handleTaskMoved = useCallback(
    (event: TaskSSEEvent) => {
      logDebug('[SSE] Task moved', { taskId: event.taskId, data: event.data });
      updateTaskInCache(event.taskId, {
        status: event.data.status as Task['status'],
        order: event.data.order,
      });
    },
    [updateTaskInCache]
  );

  // Handle task deleted event
  const handleTaskDeleted = useCallback(
    (event: TaskSSEEvent) => {
      logDebug('[SSE] Task deleted', { taskId: event.taskId });
      queryClient.setQueriesData<TaskListResponse>(
        { queryKey: tasksQueryKey({ projectId }) },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.filter((task) => task.id !== event.taskId),
            pagination: {
              ...oldData.pagination,
              total: oldData.pagination.total - 1,
            },
          };
        }
      );
    },
    [queryClient, projectId]
  );

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    logDebug('[SSE] Starting polling fallback');
    setIsPolling(true);

    pollingIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: tasksQueryKey({ projectId }),
      });
    }, pollingInterval);
  }, [queryClient, projectId, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
      logDebug('[SSE] Stopped polling');
    }
  }, []);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!enabled || !projectId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/realtime/projects/${projectId}`;
    logDebug('[SSE] Connecting to', { url });

    try {
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        logDebug('[SSE] Connected to project', { projectId });
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
        stopPolling();
      };

      // Handle connection event from server
      eventSource.addEventListener('connected', (e) => {
        logDebug('[SSE] Server confirmed connection', { data: e.data });
      });

      // Handle task events
      eventSource.addEventListener('task_created', (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSEEvent;
          handleTaskCreated(data);
        } catch (err) {
          logError('[SSE] Failed to parse task_created event', { error: err });
        }
      });

      eventSource.addEventListener('task_updated', (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSEEvent;
          handleTaskUpdated(data);
        } catch (err) {
          logError('[SSE] Failed to parse task_updated event', { error: err });
        }
      });

      eventSource.addEventListener('task_moved', (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSEEvent;
          handleTaskMoved(data);
        } catch (err) {
          logError('[SSE] Failed to parse task_moved event', { error: err });
        }
      });

      eventSource.addEventListener('task_deleted', (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSEEvent;
          handleTaskDeleted(data);
        } catch (err) {
          logError('[SSE] Failed to parse task_deleted event', { error: err });
        }
      });

      eventSource.onerror = (e) => {
        logError('[SSE] Connection error', { event: e });
        setIsConnected(false);
        setError(new Error('SSE connection failed'));

        // Close the errored connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = reconnectBaseDelay * Math.pow(2, reconnectAttempts);
          logDebug('[SSE] Reconnecting', { delay, attempt: reconnectAttempts + 1, maxAttempts: maxReconnectAttempts });
          
          setReconnectAttempts((prev) => prev + 1);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          logDebug('[SSE] Max reconnection attempts reached, falling back to polling');
          startPolling();
        }
      };
    } catch (err) {
      logError('[SSE] Failed to create EventSource', { error: err });
      setError(err instanceof Error ? err : new Error('Failed to create SSE connection'));
      startPolling();
    }
  }, [
    enabled,
    projectId,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectBaseDelay,
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskMoved,
    handleTaskDeleted,
    startPolling,
    stopPolling,
  ]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setReconnectAttempts(0);
    stopPolling();
    connect();
  }, [connect, stopPolling]);

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    if (enabled && projectId) {
      connect();
    }

    return () => {
      // Cleanup
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      stopPolling();
      setIsConnected(false);
    };
  }, [enabled, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isPolling,
    error,
    reconnectAttempts,
    reconnect,
  };
}
