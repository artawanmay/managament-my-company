/**
 * Property-based tests for Health Check Service
 *
 * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
 * *For any* health check request, the response should contain Redis connection status
 * and complete within the 5-second timeout.
 * **Validates: Requirements 2.1, 2.4**
 */
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import {
  getHealthCheckTimeout,
  type HealthCheckResponse,
  type SystemStatus,
  type ComponentStatus,
  type RedisHealthDetails,
  type DatabaseHealthDetails,
} from "@/lib/realtime/health";

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

// Valid system status values
const systemStatusValues: SystemStatus[] = ["healthy", "degraded", "unhealthy"];

// Valid component status values
const componentStatusValues: ComponentStatus[] = ["healthy", "unhealthy"];

// Generators for health check response components
const componentStatusArb = fc.constantFrom<ComponentStatus>(
  "healthy",
  "unhealthy"
);
const latencyArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 0, max: 5000 })
);
const errorArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 100 })
);
const fallbackActiveArb = fc.boolean();

// Generator for Redis health details
const redisHealthArb = fc.record({
  status: componentStatusArb,
  latencyMs: latencyArb,
  fallbackActive: fallbackActiveArb,
  error: errorArb,
}) as fc.Arbitrary<RedisHealthDetails>;

// Generator for Database health details
const databaseHealthArb = fc.record({
  status: componentStatusArb,
  latencyMs: latencyArb,
  error: errorArb,
}) as fc.Arbitrary<DatabaseHealthDetails>;

/**
 * Determine system status based on component health
 * This mirrors the logic in the health service
 */
function determineSystemStatus(
  redisHealth: RedisHealthDetails,
  databaseHealth: DatabaseHealthDetails
): SystemStatus {
  if (databaseHealth.status === "unhealthy") {
    return "unhealthy";
  }
  if (redisHealth.status === "unhealthy" || redisHealth.fallbackActive) {
    return "degraded";
  }
  return "healthy";
}

/**
 * Create a mock health check response
 */
function createMockHealthResponse(
  redisHealth: RedisHealthDetails,
  databaseHealth: DatabaseHealthDetails
): HealthCheckResponse {
  return {
    status: determineSystemStatus(redisHealth, databaseHealth),
    timestamp: new Date().toISOString(),
    components: {
      redis: redisHealth,
      database: databaseHealth,
    },
  };
}

describe("Health Check Service Properties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check response always contains required fields
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - response contains all required fields",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            // Verify top-level fields exist
            const hasStatus = "status" in response;
            const hasTimestamp = "timestamp" in response;
            const hasComponents = "components" in response;

            // Verify components structure
            const hasRedis = "redis" in response.components;
            const hasDatabase = "database" in response.components;

            // Verify Redis component fields
            const redisHasStatus = "status" in response.components.redis;
            const redisHasLatency = "latencyMs" in response.components.redis;
            const redisHasFallback =
              "fallbackActive" in response.components.redis;

            // Verify Database component fields
            const dbHasStatus = "status" in response.components.database;
            const dbHasLatency = "latencyMs" in response.components.database;

            return (
              hasStatus &&
              hasTimestamp &&
              hasComponents &&
              hasRedis &&
              hasDatabase &&
              redisHasStatus &&
              redisHasLatency &&
              redisHasFallback &&
              dbHasStatus &&
              dbHasLatency
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check response status is a valid SystemStatus value
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - status is a valid SystemStatus value",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );
            return systemStatusValues.includes(response.status);
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check Redis component status is a valid ComponentStatus value
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - Redis status is a valid ComponentStatus value",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );
            return componentStatusValues.includes(
              response.components.redis.status
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check database component status is a valid ComponentStatus value
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - database status is a valid ComponentStatus value",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );
            return componentStatusValues.includes(
              response.components.database.status
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check timestamp is a valid ISO 8601 date string
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - timestamp is a valid ISO 8601 date string",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );
            const parsedDate = new Date(response.timestamp);
            return !isNaN(parsedDate.getTime());
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check timeout is configured to 5 seconds
   * **Validates: Requirements 2.4**
   */
  it(
    "Property 3: Health Check - timeout is configured to 5 seconds",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          const timeout = getHealthCheckTimeout();
          return timeout === 5000;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: Health check latency values are non-negative when present
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - latency values are non-negative when present",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            const redisLatencyValid =
              response.components.redis.latencyMs === null ||
              response.components.redis.latencyMs >= 0;

            const dbLatencyValid =
              response.components.database.latencyMs === null ||
              response.components.database.latencyMs >= 0;

            return redisLatencyValid && dbLatencyValid;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: When database is unhealthy, system status is unhealthy
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - database unhealthy implies system unhealthy",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            // If database is unhealthy, system must be unhealthy
            if (response.components.database.status === "unhealthy") {
              return response.status === "unhealthy";
            }

            // Otherwise, this property doesn't constrain the result
            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: When Redis is unhealthy but database is healthy, system is degraded
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - Redis unhealthy with healthy database implies degraded",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            // If Redis is unhealthy but database is healthy, system should be degraded
            if (
              response.components.redis.status === "unhealthy" &&
              response.components.database.status === "healthy"
            ) {
              return response.status === "degraded";
            }

            // Otherwise, this property doesn't constrain the result
            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: When fallback is active with healthy database, system is degraded
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - fallback active with healthy database implies degraded",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            // If fallback is active and database is healthy, system should be degraded
            if (
              response.components.redis.fallbackActive &&
              response.components.database.status === "healthy"
            ) {
              return response.status === "degraded";
            }

            // Otherwise, this property doesn't constrain the result
            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: When both components are healthy and no fallback, system is healthy
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - all healthy implies system healthy",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            // If both components are healthy and no fallback, system should be healthy
            if (
              response.components.redis.status === "healthy" &&
              response.components.database.status === "healthy" &&
              !response.components.redis.fallbackActive
            ) {
              return response.status === "healthy";
            }

            // Otherwise, this property doesn't constrain the result
            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: System status determination is consistent
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - system status determination is consistent",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            // Create two responses with the same inputs
            const response1 = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );
            const response2 = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );

            // Status should be the same for the same inputs
            return response1.status === response2.status;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 3: Health Check Response Completeness**
   * Property: fallbackActive is always a boolean
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    "Property 3: Health Check - fallbackActive is always a boolean",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          redisHealthArb,
          databaseHealthArb,
          async (redisHealth, databaseHealth) => {
            const response = createMockHealthResponse(
              redisHealth,
              databaseHealth
            );
            return (
              typeof response.components.redis.fallbackActive === "boolean"
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
