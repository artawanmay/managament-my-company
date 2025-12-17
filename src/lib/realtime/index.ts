/**
 * Realtime module exports
 * Provides Redis pub/sub and SSE functionality
 */

// Redis client
export {
  getRedisClient,
  closeRedisConnection,
  isRedisAvailable,
  getConnectionState,
  onConnectionChange,
  getHealthStatus,
  executeWithFallback,
  resetRedisClient,
  // TLS support
  isTlsConnection,
  isTlsCertificateError,
  configureTls,
  type RedisHealthStatus,
  type TlsConfig,
} from "./redis";

// Fallback store
export {
  InMemoryStore,
  getFallbackStore,
  resetFallbackStore,
} from "./fallback-store";

// Fallback manager
export {
  FallbackManager,
  getFallbackManager,
  resetFallbackManager,
} from "./fallback-manager";

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
} from "./pubsub";

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
} from "./sse";

// Metrics service
export {
  MetricsService,
  getMetricsService,
  resetMetricsService,
  type RedisMetrics,
  type OperationMetric,
  type ChannelMetric,
  type MetricsSummary,
} from "./metrics";

// Health check service
export {
  performHealthCheck,
  getHealthCheckTimeout,
  type HealthCheckResponse,
  type RedisHealthDetails,
  type DatabaseHealthDetails,
  type ComponentStatus,
  type SystemStatus,
} from "./health";
