/**
 * Property-based tests for Redis Metrics Service
 *
 * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
 * *For any* Redis operation (get, set, publish, subscribe), the metrics service
 * should record the operation type, duration, and success/failure status.
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, beforeEach, expect } from "vitest";
import * as fc from "fast-check";
import { MetricsService, resetMetricsService } from "@/lib/realtime/metrics";

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

// Operation name generator
const operationArb = fc.constantFrom(
  "get",
  "set",
  "del",
  "incr",
  "exists",
  "publish",
  "subscribe"
);

// Duration generator (in milliseconds)
const durationArb = fc.integer({ min: 0, max: 10000 });

// Success/failure generator
const successArb = fc.boolean();

// Error type generator
const errorTypeArb = fc.constantFrom(
  "ConnectionError",
  "TimeoutError",
  "AuthError",
  "UnknownError"
);

// Context generator (non-empty strings only, since empty strings are not stored)
const contextArb = fc.string({ minLength: 1, maxLength: 100 });

// Channel name generator
const channelArb = fc.stringMatching(/^[a-zA-Z0-9:_-]{1,50}$/);

describe("Redis Metrics Service Properties", () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    resetMetricsService();
    metricsService = new MetricsService();
  });

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Recording an operation increases total count by 1
   * **Validates: Requirements 3.3, 3.4**
   */
  it(
    "Property 4: Metrics - recording operation increases total count",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          operationArb,
          durationArb,
          successArb,
          async (operation, duration, success) => {
            metricsService.reset();
            const beforeMetrics = metricsService.getMetrics();
            expect(beforeMetrics.operations.total).toBe(0);

            metricsService.recordOperation(operation, duration, success);

            const afterMetrics = metricsService.getMetrics();
            return afterMetrics.operations.total === 1;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Recording multiple operations accumulates total count correctly
   * **Validates: Requirements 3.3, 3.4**
   */
  it(
    "Property 4: Metrics - multiple operations accumulate correctly",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(operationArb, durationArb, successArb), {
            minLength: 1,
            maxLength: 20,
          }),
          async (operations) => {
            metricsService.reset();

            for (const [operation, duration, success] of operations) {
              metricsService.recordOperation(operation, duration, success);
            }

            const metrics = metricsService.getMetrics();
            return metrics.operations.total === operations.length;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Failed operations are counted correctly
   * **Validates: Requirements 3.4**
   */
  it(
    "Property 4: Metrics - failed operations are counted correctly",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(operationArb, durationArb, successArb), {
            minLength: 1,
            maxLength: 20,
          }),
          async (operations) => {
            metricsService.reset();

            for (const [operation, duration, success] of operations) {
              metricsService.recordOperation(operation, duration, success);
            }

            const expectedFailed = operations.filter(
              ([, , success]) => !success
            ).length;
            const metrics = metricsService.getMetrics();
            return metrics.operations.failed === expectedFailed;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Average latency is calculated correctly
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 4: Metrics - average latency is calculated correctly",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(operationArb, durationArb, successArb), {
            minLength: 1,
            maxLength: 20,
          }),
          async (operations) => {
            metricsService.reset();

            for (const [operation, duration, success] of operations) {
              metricsService.recordOperation(operation, duration, success);
            }

            const totalDuration = operations.reduce(
              (sum, [, duration]) => sum + duration,
              0
            );
            const expectedAvg =
              Math.round((totalDuration / operations.length) * 100) / 100;
            const metrics = metricsService.getMetrics();
            return metrics.operations.avgLatencyMs === expectedAvg;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Operation metrics include error type when provided
   * **Validates: Requirements 3.4**
   */
  it(
    "Property 4: Metrics - operation metrics include error type when provided",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          operationArb,
          durationArb,
          errorTypeArb,
          contextArb,
          async (operation, duration, errorType, context) => {
            metricsService.reset();

            // Suppress console.warn for this test
            const originalWarn = console.warn;
            console.warn = () => {};

            metricsService.recordOperation(
              operation,
              duration,
              false,
              errorType,
              context
            );

            console.warn = originalWarn;

            const operationMetrics = metricsService.getOperationMetrics();
            const lastMetric = operationMetrics[operationMetrics.length - 1];

            return (
              lastMetric !== undefined &&
              lastMetric.operation === operation &&
              lastMetric.durationMs === duration &&
              lastMetric.success === false &&
              lastMetric.errorType === errorType &&
              lastMetric.context === context
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Successful operations don't have error type
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 4: Metrics - successful operations do not have error type",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          operationArb,
          durationArb,
          async (operation, duration) => {
            metricsService.reset();

            metricsService.recordOperation(operation, duration, true);

            const operationMetrics = metricsService.getOperationMetrics();
            const lastMetric = operationMetrics[operationMetrics.length - 1];

            return (
              lastMetric !== undefined &&
              lastMetric.operation === operation &&
              lastMetric.durationMs === duration &&
              lastMetric.success === true &&
              lastMetric.errorType === undefined
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Pub/sub publish increments publish count
   * **Validates: Requirements 3.1**
   */
  it(
    "Property 4: Metrics - pub/sub publish increments publish count",
    async () => {
      await fc.assert(
        fc.asyncProperty(channelArb, async (channel) => {
          metricsService.reset();

          // Suppress console.log for this test
          const originalLog = console.log;
          console.log = () => {};

          const beforeMetrics = metricsService.getMetrics();
          expect(beforeMetrics.pubsub.publishCount).toBe(0);

          metricsService.recordPubSubPublish(channel);

          console.log = originalLog;

          const afterMetrics = metricsService.getMetrics();
          return afterMetrics.pubsub.publishCount === 1;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Multiple publishes to same channel accumulate correctly
   * **Validates: Requirements 3.1**
   */
  it(
    "Property 4: Metrics - multiple publishes to same channel accumulate",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          channelArb,
          fc.integer({ min: 1, max: 20 }),
          async (channel, publishCount) => {
            metricsService.reset();

            // Suppress console.log for this test
            const originalLog = console.log;
            console.log = () => {};

            for (let i = 0; i < publishCount; i++) {
              metricsService.recordPubSubPublish(channel);
            }

            console.log = originalLog;

            const metrics = metricsService.getMetrics();
            const channelStats = metrics.pubsub.channelStats.get(channel);

            return (
              metrics.pubsub.publishCount === publishCount &&
              channelStats !== undefined &&
              channelStats.publishes === publishCount
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Publishes to different channels are tracked separately
   * **Validates: Requirements 3.1**
   */
  it(
    "Property 4: Metrics - publishes to different channels tracked separately",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(channelArb, { minLength: 1, maxLength: 10 }),
          async (channels) => {
            metricsService.reset();

            // Suppress console.log for this test
            const originalLog = console.log;
            console.log = () => {};

            // Count expected publishes per channel
            const expectedCounts = new Map<string, number>();
            for (const channel of channels) {
              metricsService.recordPubSubPublish(channel);
              expectedCounts.set(
                channel,
                (expectedCounts.get(channel) || 0) + 1
              );
            }

            console.log = originalLog;

            const metrics = metricsService.getMetrics();

            // Verify total publish count
            if (metrics.pubsub.publishCount !== channels.length) {
              return false;
            }

            // Verify per-channel counts
            for (const [channel, expectedCount] of expectedCounts) {
              const channelStats = metrics.pubsub.channelStats.get(channel);
              if (!channelStats || channelStats.publishes !== expectedCount) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Subscribe action increments active subscriptions
   * **Validates: Requirements 3.2**
   */
  it(
    "Property 4: Metrics - subscribe increments active subscriptions",
    async () => {
      await fc.assert(
        fc.asyncProperty(channelArb, async (channel) => {
          metricsService.reset();

          // Suppress console.log for this test
          const originalLog = console.log;
          console.log = () => {};

          const beforeMetrics = metricsService.getMetrics();
          expect(beforeMetrics.pubsub.activeSubscriptions).toBe(0);

          metricsService.recordPubSubSubscribe(channel, "subscribe");

          console.log = originalLog;

          const afterMetrics = metricsService.getMetrics();
          return (
            afterMetrics.pubsub.activeSubscriptions === 1 &&
            metricsService.hasActiveSubscription(channel) === true
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Unsubscribe action decrements active subscriptions
   * **Validates: Requirements 3.2**
   */
  it(
    "Property 4: Metrics - unsubscribe decrements active subscriptions",
    async () => {
      await fc.assert(
        fc.asyncProperty(channelArb, async (channel) => {
          metricsService.reset();

          // Suppress console.log for this test
          const originalLog = console.log;
          console.log = () => {};

          // First subscribe
          metricsService.recordPubSubSubscribe(channel, "subscribe");
          expect(metricsService.getMetrics().pubsub.activeSubscriptions).toBe(
            1
          );

          // Then unsubscribe
          metricsService.recordPubSubSubscribe(channel, "unsubscribe");

          console.log = originalLog;

          const afterMetrics = metricsService.getMetrics();
          return (
            afterMetrics.pubsub.activeSubscriptions === 0 &&
            metricsService.hasActiveSubscription(channel) === false
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Subscribe count per channel is tracked correctly
   * **Validates: Requirements 3.2**
   */
  it(
    "Property 4: Metrics - subscribe count per channel is tracked",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          channelArb,
          fc.integer({ min: 1, max: 10 }),
          async (channel, subscribeCount) => {
            metricsService.reset();

            // Suppress console.log for this test
            const originalLog = console.log;
            console.log = () => {};

            for (let i = 0; i < subscribeCount; i++) {
              metricsService.recordPubSubSubscribe(channel, "subscribe");
            }

            console.log = originalLog;

            const channelMetrics = metricsService.getChannelMetrics(channel);
            return (
              channelMetrics !== null &&
              channelMetrics.subscribes === subscribeCount
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Reset clears all metrics
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it(
    "Property 4: Metrics - reset clears all metrics",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(operationArb, durationArb, successArb), {
            minLength: 1,
            maxLength: 10,
          }),
          fc.array(channelArb, { minLength: 1, maxLength: 5 }),
          async (operations, channels) => {
            metricsService.reset();

            // Suppress console output for this test
            const originalLog = console.log;
            const originalWarn = console.warn;
            console.log = () => {};
            console.warn = () => {};

            // Record some operations
            for (const [operation, duration, success] of operations) {
              metricsService.recordOperation(operation, duration, success);
            }

            // Record some pub/sub activity
            for (const channel of channels) {
              metricsService.recordPubSubPublish(channel);
              metricsService.recordPubSubSubscribe(channel, "subscribe");
            }

            // Verify metrics are populated
            const beforeReset = metricsService.getMetrics();
            expect(beforeReset.operations.total).toBeGreaterThan(0);
            expect(beforeReset.pubsub.publishCount).toBeGreaterThan(0);

            // Reset
            metricsService.reset();

            console.log = originalLog;
            console.warn = originalWarn;

            // Verify all metrics are cleared
            const afterReset = metricsService.getMetrics();
            return (
              afterReset.operations.total === 0 &&
              afterReset.operations.failed === 0 &&
              afterReset.operations.avgLatencyMs === 0 &&
              afterReset.pubsub.publishCount === 0 &&
              afterReset.pubsub.activeSubscriptions === 0 &&
              afterReset.pubsub.channelStats.size === 0
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Operation metrics have valid timestamps
   * **Validates: Requirements 3.1, 3.3**
   */
  it(
    "Property 4: Metrics - operation metrics have valid timestamps",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          operationArb,
          durationArb,
          successArb,
          async (operation, duration, success) => {
            metricsService.reset();

            const beforeRecord = Date.now();
            metricsService.recordOperation(operation, duration, success);
            const afterRecord = Date.now();

            const operationMetrics = metricsService.getOperationMetrics();
            const lastMetric = operationMetrics[operationMetrics.length - 1];

            return (
              lastMetric !== undefined &&
              lastMetric.timestamp >= beforeRecord &&
              lastMetric.timestamp <= afterRecord
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Empty metrics returns zero values
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it(
    "Property 4: Metrics - empty metrics returns zero values",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          metricsService.reset();

          const metrics = metricsService.getMetrics();

          return (
            metrics.operations.total === 0 &&
            metrics.operations.failed === 0 &&
            metrics.operations.avgLatencyMs === 0 &&
            metrics.pubsub.publishCount === 0 &&
            metrics.pubsub.activeSubscriptions === 0 &&
            metrics.pubsub.channelStats.size === 0
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Channel metrics returns null for unknown channels
   * **Validates: Requirements 3.1, 3.2**
   */
  it(
    "Property 4: Metrics - channel metrics returns null for unknown channels",
    async () => {
      await fc.assert(
        fc.asyncProperty(channelArb, async (channel) => {
          metricsService.reset();

          const channelMetrics = metricsService.getChannelMetrics(channel);
          return channelMetrics === null;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 4: Metrics Recording Consistency**
   * Property: Combined operations and pub/sub metrics are independent
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it(
    "Property 4: Metrics - operations and pub/sub metrics are independent",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          async (operationCount, publishCount) => {
            metricsService.reset();

            // Suppress console output for this test
            const originalLog = console.log;
            console.log = () => {};

            // Record operations
            for (let i = 0; i < operationCount; i++) {
              metricsService.recordOperation("get", 10, true);
            }

            // Record publishes
            for (let i = 0; i < publishCount; i++) {
              metricsService.recordPubSubPublish("test-channel");
            }

            console.log = originalLog;

            const metrics = metricsService.getMetrics();

            // Operations and pub/sub should be tracked independently
            return (
              metrics.operations.total === operationCount &&
              metrics.pubsub.publishCount === publishCount
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
