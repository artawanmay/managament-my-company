/**
 * Redis Metrics Service
 * Collects and exposes Redis operation metrics for monitoring and debugging
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

/**
 * Individual operation metric record
 */
export interface OperationMetric {
  timestamp: number;
  operation: string;
  durationMs: number;
  success: boolean;
  errorType?: string;
  context?: string;
}

/**
 * Channel-specific pub/sub metrics
 */
export interface ChannelMetric {
  channel: string;
  publishCount: number;
  subscribeCount: number;
  lastActivity: number;
}

/**
 * Aggregated metrics summary
 */
export interface MetricsSummary {
  operations: {
    total: number;
    failed: number;
    avgLatencyMs: number;
  };
  pubsub: {
    publishCount: number;
    activeSubscriptions: number;
    channelStats: Map<string, { publishes: number; subscribes: number }>;
  };
}

/**
 * Redis Metrics Service interface
 */
export interface RedisMetrics {
  recordOperation(
    operation: string,
    durationMs: number,
    success: boolean,
    errorType?: string,
    context?: string
  ): void;
  recordPubSubPublish(channel: string): void;
  recordPubSubSubscribe(
    channel: string,
    action: "subscribe" | "unsubscribe"
  ): void;
  getMetrics(): MetricsSummary;
  reset(): void;
}

/**
 * Maximum number of operation metrics to retain (rolling window)
 */
const MAX_OPERATION_METRICS = 1000;

/**
 * Metrics Service implementation
 * Tracks Redis operations, pub/sub activity, and provides aggregated summaries
 */
export class MetricsService implements RedisMetrics {
  private operationMetrics: OperationMetric[] = [];
  private channelStats: Map<string, { publishes: number; subscribes: number }> =
    new Map();
  private activeSubscriptions: Set<string> = new Set();
  private totalPublishCount = 0;

  /**
   * Record a Redis operation with timing and success/failure status
   * Requirement: 3.3, 3.4
   *
   * @param operation - The type of operation (e.g., 'get', 'set', 'publish')
   * @param durationMs - How long the operation took in milliseconds
   * @param success - Whether the operation succeeded
   * @param errorType - Optional error type if operation failed
   * @param context - Optional additional context about the operation
   */
  recordOperation(
    operation: string,
    durationMs: number,
    success: boolean,
    errorType?: string,
    context?: string
  ): void {
    const metric: OperationMetric = {
      timestamp: Date.now(),
      operation,
      durationMs,
      success,
      ...(errorType && { errorType }),
      ...(context && { context }),
    };

    this.operationMetrics.push(metric);

    // Maintain rolling window to prevent unbounded memory growth
    if (this.operationMetrics.length > MAX_OPERATION_METRICS) {
      this.operationMetrics.shift();
    }

    // Log failed operations for debugging (Requirement 3.4)
    if (!success) {
      console.warn(
        `[Metrics] Redis operation failed: ${operation}`,
        errorType ? `(${errorType})` : "",
        context ? `- ${context}` : ""
      );
    }
  }

  /**
   * Record a pub/sub publish event
   * Requirement: 3.1
   *
   * @param channel - The channel name that was published to
   */
  recordPubSubPublish(channel: string): void {
    this.totalPublishCount++;

    const stats = this.channelStats.get(channel) || {
      publishes: 0,
      subscribes: 0,
    };
    stats.publishes++;
    this.channelStats.set(channel, stats);

    console.log(
      `[Metrics] Published to channel: ${channel} (total: ${stats.publishes})`
    );
  }

  /**
   * Record a pub/sub subscription event
   * Requirement: 3.2
   *
   * @param channel - The channel name
   * @param action - Whether subscribing or unsubscribing
   */
  recordPubSubSubscribe(
    channel: string,
    action: "subscribe" | "unsubscribe"
  ): void {
    const stats = this.channelStats.get(channel) || {
      publishes: 0,
      subscribes: 0,
    };

    if (action === "subscribe") {
      stats.subscribes++;
      this.activeSubscriptions.add(channel);
    } else {
      this.activeSubscriptions.delete(channel);
    }

    this.channelStats.set(channel, stats);

    console.log(
      `[Metrics] ${action === "subscribe" ? "Subscribed to" : "Unsubscribed from"} channel: ${channel} ` +
        `(active subscriptions: ${this.activeSubscriptions.size})`
    );
  }

  /**
   * Get aggregated metrics summary
   * Requirements: 3.1, 3.2, 3.3, 3.4
   *
   * @returns MetricsSummary with operation and pub/sub statistics
   */
  getMetrics(): MetricsSummary {
    const total = this.operationMetrics.length;
    const failed = this.operationMetrics.filter((m) => !m.success).length;

    // Calculate average latency
    const avgLatencyMs =
      total > 0
        ? this.operationMetrics.reduce((sum, m) => sum + m.durationMs, 0) /
          total
        : 0;

    return {
      operations: {
        total,
        failed,
        avgLatencyMs: Math.round(avgLatencyMs * 100) / 100, // Round to 2 decimal places
      },
      pubsub: {
        publishCount: this.totalPublishCount,
        activeSubscriptions: this.activeSubscriptions.size,
        channelStats: new Map(this.channelStats),
      },
    };
  }

  /**
   * Reset all metrics (primarily for testing)
   */
  reset(): void {
    this.operationMetrics = [];
    this.channelStats.clear();
    this.activeSubscriptions.clear();
    this.totalPublishCount = 0;
  }

  /**
   * Get raw operation metrics (for detailed analysis)
   */
  getOperationMetrics(): OperationMetric[] {
    return [...this.operationMetrics];
  }

  /**
   * Get metrics for a specific channel
   */
  getChannelMetrics(
    channel: string
  ): { publishes: number; subscribes: number } | null {
    return this.channelStats.get(channel) || null;
  }

  /**
   * Check if a channel has active subscriptions
   */
  hasActiveSubscription(channel: string): boolean {
    return this.activeSubscriptions.has(channel);
  }
}

// Singleton instance
let metricsServiceInstance: MetricsService | null = null;

/**
 * Get the singleton metrics service instance
 */
export function getMetricsService(): MetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
}

/**
 * Reset the metrics service (primarily for testing)
 */
export function resetMetricsService(): void {
  if (metricsServiceInstance) {
    metricsServiceInstance.reset();
  }
  metricsServiceInstance = null;
}
