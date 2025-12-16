/**
 * useNotificationsSSE hook for realtime notification updates via SSE
 * Connects to notifications SSE endpoint and updates TanStack Query cache on events
 * Falls back to polling on connection failure
 *
 * Requirements: 9.2, 9.6, 20.3, 20.4
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsQueryKey } from './use-notifications';
import type { Notification, NotificationsListResponse } from '../types';

// SSE notification event from the server
interface NotificationSSEEvent {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

interface UseNotificationsSSEOptions {
  /** Whether the hook is enabled */
  enabled?: boolean;
  /** Polling interval in ms when SSE fails (default: 30000) */
  pollingInterval?: number;
  /** Max reconnection attempts before falling back to polling (default: 3) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  reconnectBaseDelay?: number;
}

interface UseNotificationsSSEReturn {
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

export function useNotificationsSSE({
  enabled = true,
  pollingInterval = 30000,
  maxReconnectAttempts = 3,
  reconnectBaseDelay = 1000,
}: UseNotificationsSSEOptions = {}): UseNotificationsSSEReturn {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Add new notification to cache
  const addNotificationToCache = useCallback(
    (event: NotificationSSEEvent) => {
      const newNotification: Notification = {
        id: event.notificationId,
        userId: event.userId,
        type: event.type as Notification['type'],
        title: event.title,
        message: event.message,
        data: event.entityType || event.entityId
          ? {
              entityType: event.entityType as 'TASK' | 'PROJECT' | 'COMMENT' | 'CLIENT' | 'NOTE' | undefined,
              entityId: event.entityId,
            }
          : null,
        readAt: null,
        createdAt: new Date(event.timestamp),
      };

      // Update all notification queries
      queryClient.setQueriesData<NotificationsListResponse>(
        { queryKey: ['notifications'] },
        (oldData) => {
          if (!oldData) return oldData;

          // Check if notification already exists
          const exists = oldData.data.some((n) => n.id === newNotification.id);
          if (exists) return oldData;

          return {
            ...oldData,
            data: [newNotification, ...oldData.data],
            unreadCount: oldData.unreadCount + 1,
            totalCount: oldData.totalCount + 1,
          };
        }
      );

      console.log('[SSE] Added notification to cache:', newNotification.id);
    },
    [queryClient]
  );

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log('[SSE] Starting notifications polling fallback');
    setIsPolling(true);

    pollingIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: notificationsQueryKey(),
      });
    }, pollingInterval);
  }, [queryClient, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
      console.log('[SSE] Stopped notifications polling');
    }
  }, []);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = '/api/realtime/notifications';
    console.log('[SSE] Connecting to notifications:', url);

    try {
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connected to notifications');
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
        stopPolling();
      };

      // Handle connection event from server
      eventSource.addEventListener('connected', (e) => {
        console.log('[SSE] Server confirmed notifications connection:', e.data);
      });

      // Handle notification event
      eventSource.addEventListener('notification', (e) => {
        try {
          const data = JSON.parse(e.data) as NotificationSSEEvent;
          console.log('[SSE] Received notification:', data);
          addNotificationToCache(data);
        } catch (err) {
          console.error('[SSE] Failed to parse notification event:', err);
        }
      });

      eventSource.onerror = (e) => {
        console.error('[SSE] Notifications connection error:', e);
        setIsConnected(false);
        setError(new Error('SSE connection failed'));

        // Close the errored connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = reconnectBaseDelay * Math.pow(2, reconnectAttempts);
          console.log(`[SSE] Reconnecting notifications in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          setReconnectAttempts((prev) => prev + 1);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log('[SSE] Max reconnection attempts reached, falling back to polling');
          startPolling();
        }
      };
    } catch (err) {
      console.error('[SSE] Failed to create notifications EventSource:', err);
      setError(err instanceof Error ? err : new Error('Failed to create SSE connection'));
      startPolling();
    }
  }, [
    enabled,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectBaseDelay,
    addNotificationToCache,
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
    if (enabled) {
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
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isPolling,
    error,
    reconnectAttempts,
    reconnect,
  };
}
