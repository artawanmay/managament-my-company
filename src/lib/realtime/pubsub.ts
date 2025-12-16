/**
 * Redis Pub/Sub Service
 * Provides publish and subscribe helpers for realtime communication
 *
 * Channels:
 * - project:{projectId}:tasks - Task updates for Kanban board
 * - user:{userId}:notifications - User notifications
 *
 * Requirements: 20.1, 20.2
 */
import Redis from 'ioredis';
import { getRedisClient } from './redis';

// Channel name constants
export const CHANNELS = {
  projectTasks: (projectId: string) => `project:${projectId}:tasks`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
} as const;

// Event types for type safety
export type TaskEventType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_MOVED'
  | 'TASK_DELETED';

export type NotificationEventType = 'NOTIFICATION_CREATED';

export interface TaskEvent {
  type: TaskEventType;
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

export interface NotificationEvent {
  type: NotificationEventType;
  notificationId: string;
  userId: string;
  data: {
    title: string;
    message: string;
    notificationType: string;
    entityType?: string;
    entityId?: string;
  };
  timestamp: string;
}

// Subscriber client (separate from main client for pub/sub)
let subscriberClient: Redis | null = null;

/**
 * Get or create a dedicated subscriber Redis client
 * Redis requires separate connections for pub/sub
 */
function getSubscriberClient(): Redis {
  if (!subscriberClient) {
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    subscriberClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 30000);
        return delay;
      },
      lazyConnect: true,
    });

    subscriberClient.on('error', (err) => {
      console.error('[Redis Subscriber] Connection error:', err.message);
    });
  }

  return subscriberClient;
}

/**
 * Publish a message to a Redis channel
 * @param channel - The channel name to publish to
 * @param message - The message object to publish (will be JSON stringified)
 */
export async function publish<T extends object>(
  channel: string,
  message: T
): Promise<void> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(message);
    await client.publish(channel, serialized);
    console.log(`[PubSub] Published to ${channel}:`, message);
  } catch (error) {
    console.error(`[PubSub] Failed to publish to ${channel}:`, error);
    throw error;
  }
}

/**
 * Subscribe to a Redis channel
 * @param channel - The channel name to subscribe to
 * @param handler - Callback function to handle received messages
 * @returns Unsubscribe function to clean up the subscription
 */
export function subscribe<T extends object>(
  channel: string,
  handler: (message: T) => void
): () => void {
  const client = getSubscriberClient();

  const messageHandler = (receivedChannel: string, message: string) => {
    if (receivedChannel === channel) {
      try {
        const parsed = JSON.parse(message) as T;
        handler(parsed);
      } catch (error) {
        console.error(`[PubSub] Failed to parse message from ${channel}:`, error);
      }
    }
  };

  // Subscribe to the channel
  client.subscribe(channel).catch((err) => {
    console.error(`[PubSub] Failed to subscribe to ${channel}:`, err);
  });

  // Add message listener
  client.on('message', messageHandler);

  console.log(`[PubSub] Subscribed to ${channel}`);

  // Return unsubscribe function
  return () => {
    client.unsubscribe(channel).catch((err) => {
      console.error(`[PubSub] Failed to unsubscribe from ${channel}:`, err);
    });
    client.removeListener('message', messageHandler);
    console.log(`[PubSub] Unsubscribed from ${channel}`);
  };
}

/**
 * Publish a task event to a project's task channel
 * @param projectId - The project ID
 * @param event - The task event to publish
 */
export async function publishTaskEvent(
  projectId: string,
  event: TaskEvent
): Promise<void> {
  const channel = CHANNELS.projectTasks(projectId);
  await publish(channel, event);
}

/**
 * Subscribe to task events for a project
 * @param projectId - The project ID
 * @param handler - Callback function to handle task events
 * @returns Unsubscribe function
 */
export function subscribeToTaskEvents(
  projectId: string,
  handler: (event: TaskEvent) => void
): () => void {
  const channel = CHANNELS.projectTasks(projectId);
  return subscribe(channel, handler);
}

/**
 * Publish a notification event to a user's notification channel
 * @param userId - The user ID
 * @param event - The notification event to publish
 */
export async function publishNotificationEvent(
  userId: string,
  event: NotificationEvent
): Promise<void> {
  const channel = CHANNELS.userNotifications(userId);
  await publish(channel, event);
}

/**
 * Subscribe to notification events for a user
 * @param userId - The user ID
 * @param handler - Callback function to handle notification events
 * @returns Unsubscribe function
 */
export function subscribeToNotificationEvents(
  userId: string,
  handler: (event: NotificationEvent) => void
): () => void {
  const channel = CHANNELS.userNotifications(userId);
  return subscribe(channel, handler);
}

/**
 * Close the subscriber client connection
 * Should be called during application shutdown
 */
export async function closeSubscriberConnection(): Promise<void> {
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
    console.log('[Redis Subscriber] Connection closed gracefully');
  }
}
