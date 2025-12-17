/**
 * Health Check Service
 * Provides health status for monitoring systems including Redis and database status.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { getHealthStatus as getRedisHealthStatus } from "./redis";
import { getFallbackManager } from "./fallback-manager";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Health check timeout in milliseconds (5 seconds as per requirement 2.4)
 */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Component health status
 */
export type ComponentStatus = "healthy" | "unhealthy";

/**
 * Overall system health status
 */
export type SystemStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Redis component health details
 */
export interface RedisHealthDetails {
  status: ComponentStatus;
  latencyMs: number | null;
  fallbackActive: boolean;
  error?: string;
}

/**
 * Database component health details
 */
export interface DatabaseHealthDetails {
  status: ComponentStatus;
  latencyMs: number | null;
  error?: string;
}

/**
 * Complete health check response
 */
export interface HealthCheckResponse {
  status: SystemStatus;
  timestamp: string;
  components: {
    redis: RedisHealthDetails;
    database: DatabaseHealthDetails;
  };
}

/**
 * Execute a function with a timeout
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns The result of the function or throws on timeout
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Health check timeout")), timeoutMs)
    ),
  ]);
}

/**
 * Check Redis health with latency measurement
 * Requirements: 2.1, 2.2, 2.3
 */
async function checkRedisHealth(): Promise<RedisHealthDetails> {
  const fallbackManager = getFallbackManager();
  const fallbackActive = fallbackManager.isInFallbackMode();

  try {
    const redisStatus = await withTimeout(
      () => getRedisHealthStatus(),
      HEALTH_CHECK_TIMEOUT_MS
    );

    if (redisStatus.connected) {
      return {
        status: "healthy",
        latencyMs: redisStatus.latencyMs,
        fallbackActive,
      };
    } else {
      return {
        status: "unhealthy",
        latencyMs: redisStatus.latencyMs,
        fallbackActive,
        error: redisStatus.lastError || "Redis not connected",
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: null,
      fallbackActive,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check database health with latency measurement
 */
async function checkDatabaseHealth(): Promise<DatabaseHealthDetails> {
  const startTime = Date.now();

  try {
    // Execute a simple query to check database connectivity
    await withTimeout(async () => {
      await db.run(sql`SELECT 1`);
    }, HEALTH_CHECK_TIMEOUT_MS);

    const latencyMs = Date.now() - startTime;

    return {
      status: "healthy",
      latencyMs,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Determine overall system status based on component health
 * - healthy: All components are healthy
 * - degraded: Some non-critical components are unhealthy (e.g., Redis with fallback)
 * - unhealthy: Critical components are unhealthy (e.g., database)
 */
function determineSystemStatus(
  redisHealth: RedisHealthDetails,
  databaseHealth: DatabaseHealthDetails
): SystemStatus {
  // Database is critical - if it's down, system is unhealthy
  if (databaseHealth.status === "unhealthy") {
    return "unhealthy";
  }

  // Redis is non-critical (has fallback) - if it's down, system is degraded
  if (redisHealth.status === "unhealthy" || redisHealth.fallbackActive) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Perform a complete health check of all system components
 * Requirements: 2.1, 2.2, 2.3, 2.4
 *
 * @returns Health check response with status of all components
 */
export async function performHealthCheck(): Promise<HealthCheckResponse> {
  // Run health checks in parallel for efficiency
  const [redisHealth, databaseHealth] = await Promise.all([
    checkRedisHealth(),
    checkDatabaseHealth(),
  ]);

  const status = determineSystemStatus(redisHealth, databaseHealth);

  return {
    status,
    timestamp: new Date().toISOString(),
    components: {
      redis: redisHealth,
      database: databaseHealth,
    },
  };
}

/**
 * Get the health check timeout value (for testing purposes)
 */
export function getHealthCheckTimeout(): number {
  return HEALTH_CHECK_TIMEOUT_MS;
}
