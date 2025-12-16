/**
 * Realtime module exports
 * Provides Redis pub/sub and SSE functionality
 */

// Redis client
export {
  getRedisClient,
  closeRedisConnection,
  isRedisAvailable,
} from './redis';

// Pub/Sub service
export {
  CHANNELS,
  publish,
  subscribe,
  publishTaskEvent,
  subscribeToTaskEvents,
  publishNotificationEvent,
  subscribeToNotificationEvents,
  closeSubscriberConnection,
  type TaskEvent,
  type TaskEventType,
  type NotificationEvent,
  type NotificationEventType,
} from './pubsub';

// SSE helpers
export {
  createSSEResponse,
  registerProjectConnection,
  unregisterProjectConnection,
  registerUserConnection,
  unregisterUserConnection,
  broadcastToProject,
  sendToUser,
  getProjectConnectionCount,
  getUserConnectionCount,
  getConnectionStats,
  type SSEConnection,
} from './sse';
