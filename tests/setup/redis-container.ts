/**
 * Redis Container Setup Utility for Integration Tests
 *
 * Provides a real Redis instance via testcontainers for integration testing.
 * This enables testing of distributed behavior, pub/sub, and lockout functionality
 * with a real Redis server.
 *
 * Requirements: 5.1
 */

import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";

/**
 * Configuration options for the Redis test container
 */
export interface RedisContainerOptions {
  /** Redis image tag (default: 'redis:7-alpine') */
  imageTag?: string;
  /** Container startup timeout in milliseconds (default: 60000) */
  startupTimeout?: number;
}

/**
 * Result of starting a Redis container
 */
export interface RedisTestContext {
  /** The started Redis container instance */
  container: StartedRedisContainer;
  /** Redis client connected to the container */
  client: Redis;
  /** Connection URL for the Redis container */
  connectionUrl: string;
  /** Host of the Redis container */
  host: string;
  /** Port of the Redis container */
  port: number;
}

/**
 * Default Redis image to use for testing
 */
const DEFAULT_REDIS_IMAGE = "redis:7-alpine";

/**
 * Default startup timeout in milliseconds
 */
const DEFAULT_STARTUP_TIMEOUT = 60000;

/**
 * Start a Redis container for integration testing
 *
 * @param options - Configuration options for the container
 * @returns RedisTestContext with container, client, and connection details
 *
 * @example
 * ```typescript
 * const ctx = await startRedisContainer();
 * try {
 *   await ctx.client.set('key', 'value');
 *   const value = await ctx.client.get('key');
 *   expect(value).toBe('value');
 * } finally {
 *   await stopRedisContainer(ctx);
 * }
 * ```
 */
export async function startRedisContainer(
  options: RedisContainerOptions = {}
): Promise<RedisTestContext> {
  const {
    imageTag = DEFAULT_REDIS_IMAGE,
    startupTimeout = DEFAULT_STARTUP_TIMEOUT,
  } = options;

  // Start the Redis container
  const container = await new RedisContainer(imageTag)
    .withStartupTimeout(startupTimeout)
    .start();

  // Get connection details
  const host = container.getHost();
  const port = container.getMappedPort(6379);
  const connectionUrl = container.getConnectionUrl();

  // Create a Redis client connected to the container
  const client = new Redis({
    host,
    port,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 100, 1000);
    },
  });

  // Wait for the client to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Redis client connection timeout"));
    }, 10000);

    client.once("ready", () => {
      clearTimeout(timeout);
      resolve();
    });

    client.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return {
    container,
    client,
    connectionUrl,
    host,
    port,
  };
}

/**
 * Stop a Redis container and clean up resources
 *
 * @param ctx - The Redis test context to clean up
 */
export async function stopRedisContainer(ctx: RedisTestContext): Promise<void> {
  // Disconnect the Redis client
  if (ctx.client) {
    try {
      await ctx.client.quit();
    } catch {
      // Ignore errors during cleanup
    }
  }

  // Stop the container
  if (ctx.container) {
    try {
      await ctx.container.stop();
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Create a new Redis client connected to the test container
 *
 * Useful for testing scenarios that require multiple clients
 * (e.g., pub/sub, distributed lockout)
 *
 * @param ctx - The Redis test context
 * @returns A new Redis client instance
 */
export function createAdditionalClient(ctx: RedisTestContext): Redis {
  return new Redis({
    host: ctx.host,
    port: ctx.port,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 100, 1000);
    },
  });
}

/**
 * Clear all data in the Redis container
 *
 * Useful for cleaning up between tests
 *
 * @param ctx - The Redis test context
 */
export async function clearRedisData(ctx: RedisTestContext): Promise<void> {
  await ctx.client.flushall();
}

/**
 * Helper to run a test with a Redis container
 *
 * Automatically starts and stops the container, handling cleanup
 *
 * @param testFn - The test function to run
 * @param options - Configuration options for the container
 *
 * @example
 * ```typescript
 * await withRedisContainer(async (ctx) => {
 *   await ctx.client.set('key', 'value');
 *   expect(await ctx.client.get('key')).toBe('value');
 * });
 * ```
 */
export async function withRedisContainer(
  testFn: (ctx: RedisTestContext) => Promise<void>,
  options: RedisContainerOptions = {}
): Promise<void> {
  const ctx = await startRedisContainer(options);
  try {
    await testFn(ctx);
  } finally {
    await stopRedisContainer(ctx);
  }
}
