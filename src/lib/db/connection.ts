/**
 * Database connection module with retry logic for production deployments.
 *
 * Implements exponential backoff for connection retries:
 * - Delays: 1s, 2s, 4s, 8s, 16s
 * - Maximum 5 retry attempts before failure
 *
 * **Feature: dokploy-deployment**
 * **Validates: Requirements 2.3, 2.4**
 */

import { logger } from "@/lib/logger";

/**
 * Configuration for connection retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 16000) */
  maxDelayMs: number;
}

/**
 * Result of a connection attempt
 */
export interface ConnectionResult<T> {
  success: boolean;
  connection?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

/**
 * Default retry configuration
 * Implements exponential backoff: 1s, 2s, 4s, 8s, 16s
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
};

/**
 * Calculate the delay for a given retry attempt using exponential backoff.
 *
 * @param attempt - The current attempt number (1-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  // Attempt 1: 1s, Attempt 2: 2s, Attempt 3: 4s, Attempt 4: 8s, Attempt 5: 16s
  const delay = config.baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Get all backoff delays for a given configuration.
 * Useful for testing and documentation.
 *
 * @param config - Retry configuration
 * @returns Array of delays in milliseconds for each attempt
 */
export function getBackoffSequence(
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number[] {
  const delays: number[] = [];
  for (let i = 1; i <= config.maxRetries; i++) {
    delays.push(calculateBackoffDelay(i, config));
  }
  return delays;
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to connect to a database with exponential backoff retry logic.
 *
 * @param connectFn - Async function that attempts to establish a connection
 * @param config - Retry configuration (optional, uses defaults)
 * @returns ConnectionResult with success status, connection, and metadata
 */
export async function connectWithRetry<T>(
  connectFn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ConnectionResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      logger.info(`Database connection attempt ${attempt}/${config.maxRetries}`);

      const connection = await connectFn();

      const totalTimeMs = Date.now() - startTime;
      logger.info(`Database connected successfully after ${attempt} attempt(s)`, {
        attempts: attempt,
        totalTimeMs,
      });

      return {
        success: true,
        connection,
        attempts: attempt,
        totalTimeMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const delay = calculateBackoffDelay(attempt, config);

      logger.warn(`Database connection attempt ${attempt} failed`, {
        attempt,
        maxRetries: config.maxRetries,
        error: lastError.message,
        nextRetryDelayMs: attempt < config.maxRetries ? delay : null,
      });

      // Don't sleep after the last attempt
      if (attempt < config.maxRetries) {
        logger.info(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  const totalTimeMs = Date.now() - startTime;

  logger.error(
    `Database connection failed after ${config.maxRetries} attempts`,
    {
      totalTimeMs,
      lastError: lastError?.message,
    }
  );

  return {
    success: false,
    error: lastError,
    attempts: config.maxRetries,
    totalTimeMs,
  };
}

/**
 * Verify database connectivity by executing a simple query.
 * This is used during startup to ensure the database is ready.
 *
 * @param queryFn - Function that executes a simple query (e.g., SELECT 1)
 * @param timeoutMs - Maximum time to wait for the query (default: 5000ms)
 * @returns True if the query succeeds, false otherwise
 */
export async function verifyDatabaseConnectivity(
  queryFn: () => Promise<unknown>,
  timeoutMs: number = 5000
): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database connectivity check timed out")), timeoutMs);
    });

    await Promise.race([queryFn(), timeoutPromise]);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Database connectivity verification failed", { error: errorMessage });
    return false;
  }
}

/**
 * Connect to database with retry and verify connectivity.
 * Combines connection retry with connectivity verification.
 *
 * @param connectFn - Async function that establishes a connection
 * @param verifyFn - Async function that verifies the connection works
 * @param config - Retry configuration
 * @returns ConnectionResult with verified connection
 */
export async function connectAndVerify<T>(
  connectFn: () => Promise<T>,
  verifyFn: (connection: T) => Promise<unknown>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ConnectionResult<T>> {
  const result = await connectWithRetry(async () => {
    const connection = await connectFn();

    // Verify the connection works
    await verifyFn(connection);

    return connection;
  }, config);

  return result;
}

/**
 * Format a database URL for logging (redacts password).
 *
 * @param url - Database connection URL
 * @returns URL with password redacted
 */
export function redactDatabaseUrl(url: string): string {
  try {
    // Handle PostgreSQL URLs: postgresql://user:password@host:port/database
    const pgPattern = /(postgres(?:ql)?:\/\/)(?:([^:@]+):)?([^@]+)@/gi;
    return url.replace(pgPattern, (_match, protocol, username, _password) => {
      if (username) {
        return `${protocol}${username}:[REDACTED]@`;
      }
      return `${protocol}[REDACTED]@`;
    });
  } catch {
    return "[REDACTED_URL]";
  }
}
