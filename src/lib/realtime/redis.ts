/**
 * Redis client connection management
 * Used for realtime pub/sub and rate limiting (login lockout)
 *
 * Enhanced with:
 * - Connection state tracking
 * - Fallback manager integration
 * - Automatic reconnection logic
 * - Credential redaction in logs
 * - TLS/SSL support for secure connections
 *
 * Requirements: 1.3, 1.4, 4.1, 4.2, 4.3, 4.4
 */
import Redis, { RedisOptions } from "ioredis";
import { getFallbackManager } from "./fallback-manager";
import { redactCredentials } from "../logger";

// Redis connection URL from environment
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Reconnection interval in milliseconds (30 seconds as per design)
const RECONNECTION_INTERVAL_MS = 30000;

/**
 * TLS configuration options for Redis connections
 * Used when connecting via rediss:// protocol
 */
export interface TlsConfig {
  /** Whether to reject unauthorized certificates (default: true in production) */
  rejectUnauthorized?: boolean;
  /** Optional CA certificate for custom certificate authorities */
  ca?: string;
  /** Optional client certificate for mutual TLS */
  cert?: string;
  /** Optional client key for mutual TLS */
  key?: string;
}

/**
 * Detect if the Redis URL uses TLS (rediss:// protocol)
 * Requirement: 4.1
 * @param url - Redis connection URL
 * @returns true if the URL uses rediss:// protocol
 */
export function isTlsConnection(url: string): boolean {
  return url.toLowerCase().startsWith("rediss://");
}

/**
 * Build TLS options for Redis connection
 * Requirement: 4.1, 4.3
 * @param tlsConfig - Optional TLS configuration overrides
 * @returns TLS options object for ioredis or undefined if not TLS
 */
function buildTlsOptions(
  tlsConfig?: TlsConfig
): RedisOptions["tls"] | undefined {
  if (!isTlsConnection(REDIS_URL)) {
    return undefined;
  }

  // Default TLS options for secure connections
  const tlsOptions: RedisOptions["tls"] = {
    // In production, always verify certificates by default
    // Can be overridden via tlsConfig for development/testing
    rejectUnauthorized:
      tlsConfig?.rejectUnauthorized ?? process.env.NODE_ENV === "production",
  };

  // Add optional CA certificate if provided
  if (tlsConfig?.ca) {
    tlsOptions.ca = tlsConfig.ca;
  }

  // Add optional client certificate for mutual TLS
  if (tlsConfig?.cert) {
    tlsOptions.cert = tlsConfig.cert;
  }

  // Add optional client key for mutual TLS
  if (tlsConfig?.key) {
    tlsOptions.key = tlsConfig.key;
  }

  return tlsOptions;
}

/**
 * Check if an error is a TLS certificate-related error
 * Requirement: 4.3
 * @param error - Error to check
 * @returns true if the error is related to TLS certificate validation
 */
export function isTlsCertificateError(error: Error): boolean {
  const tlsErrorCodes = [
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "CERT_CHAIN_TOO_LONG",
    "CERT_REVOKED",
    "INVALID_CA",
    "INVALID_PURPOSE",
    "CERT_UNTRUSTED",
    "CERT_REJECTED",
    "HOSTNAME_MISMATCH",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ];

  // Check error code property (Node.js TLS errors)
  const errorCode = (error as NodeJS.ErrnoException).code;
  if (errorCode && tlsErrorCodes.includes(errorCode)) {
    return true;
  }

  // Check error message for common TLS error patterns
  const message = error.message.toLowerCase();
  return (
    message.includes("certificate") ||
    message.includes("ssl") ||
    message.includes("tls") ||
    message.includes("self signed") ||
    message.includes("unable to verify")
  );
}

// Connection state tracking
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type ConnectionChangeCallback = (connected: boolean) => void;

// Singleton Redis client instance
let redisClient: Redis | null = null;

// Connection state
let connectionState: ConnectionState = "disconnected";
let connectionChangeCallbacks: ConnectionChangeCallback[] = [];
let reconnectionTimer: ReturnType<typeof setInterval> | null = null;
let lastError: string | null = null;

/**
 * Health status interface for Redis
 */
export interface RedisHealthStatus {
  connected: boolean;
  latencyMs: number | null;
  lastError: string | null;
  lastCheckedAt: string;
}

/**
 * Get the current connection state
 */
export function getConnectionState(): ConnectionState {
  return connectionState;
}

/**
 * Set the connection state and notify callbacks
 */
function setConnectionState(newState: ConnectionState): void {
  const wasConnected = connectionState === "connected";
  connectionState = newState;
  const isConnected = newState === "connected";

  // Only notify if connection status actually changed
  if (wasConnected !== isConnected) {
    notifyConnectionChange(isConnected);
  }
}

/**
 * Notify all registered callbacks of connection state change
 */
function notifyConnectionChange(connected: boolean): void {
  for (const callback of connectionChangeCallbacks) {
    try {
      callback(connected);
    } catch (error) {
      console.error("[Redis] Error in connection change callback:", error);
    }
  }
}

/**
 * Register a callback to be notified when connection state changes
 * @param callback - Function to call when connection state changes
 * @returns Unsubscribe function
 */
export function onConnectionChange(
  callback: ConnectionChangeCallback
): () => void {
  connectionChangeCallbacks.push(callback);
  return () => {
    const index = connectionChangeCallbacks.indexOf(callback);
    if (index > -1) {
      connectionChangeCallbacks.splice(index, 1);
    }
  };
}

/**
 * Start automatic reconnection attempts
 * Attempts to reconnect every 30 seconds when in fallback mode
 * Requirement: 1.3
 */
function startReconnectionTimer(): void {
  if (reconnectionTimer) {
    return; // Already running
  }

  console.log(
    "[Redis] Starting automatic reconnection attempts every 30 seconds"
  );

  reconnectionTimer = setInterval(async () => {
    const fallbackManager = getFallbackManager();

    // Only attempt reconnection if in fallback mode
    if (!fallbackManager.isInFallbackMode()) {
      stopReconnectionTimer();
      return;
    }

    console.log("[Redis] Attempting automatic reconnection...");

    try {
      const available = await isRedisAvailable();
      if (available) {
        console.log("[Redis] Reconnection successful");
        fallbackManager.deactivateFallback();
        stopReconnectionTimer();
      } else {
        console.log("[Redis] Reconnection failed, will retry in 30 seconds");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        "[Redis] Reconnection attempt failed:",
        redactCredentials(errorMessage)
      );
    }
  }, RECONNECTION_INTERVAL_MS);
}

/**
 * Stop the automatic reconnection timer
 */
function stopReconnectionTimer(): void {
  if (reconnectionTimer) {
    clearInterval(reconnectionTimer);
    reconnectionTimer = null;
    console.log("[Redis] Stopped automatic reconnection attempts");
  }
}

/**
 * Handle Redis connection failure
 * Activates fallback mode and starts reconnection timer
 * Requirements: 1.1, 1.4, 4.4
 */
function handleConnectionFailure(error?: Error): void {
  const fallbackManager = getFallbackManager();

  // Redact credentials from stored error messages
  // Requirement: 4.4
  lastError = redactCredentials(error?.message || "Connection failed");
  setConnectionState("error");

  // Activate fallback mode if not already active
  if (!fallbackManager.isInFallbackMode()) {
    fallbackManager.activateFallback();
    startReconnectionTimer();
  }
}

/**
 * Handle Redis connection success
 * Deactivates fallback mode if active
 * Requirement: 1.3
 */
function handleConnectionSuccess(): void {
  const fallbackManager = getFallbackManager();

  lastError = null;
  setConnectionState("connected");

  // Deactivate fallback mode if active
  if (fallbackManager.isInFallbackMode()) {
    fallbackManager.deactivateFallback();
    stopReconnectionTimer();
  }
}

// Store TLS config for client creation
let tlsConfiguration: TlsConfig | undefined;

/**
 * Configure TLS options for Redis connections
 * Call this before getRedisClient() to set custom TLS options
 * @param config - TLS configuration options
 */
export function configureTls(config: TlsConfig): void {
  tlsConfiguration = config;
  console.log("[Redis] TLS configuration updated");
}

/**
 * Get or create the Redis client instance
 * Uses lazy initialization to avoid connection issues during module loading
 * Supports TLS connections via rediss:// protocol
 * Requirements: 4.1, 4.2, 4.3
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    setConnectionState("connecting");

    const isTls = isTlsConnection(REDIS_URL);
    if (isTls) {
      console.log("[Redis] TLS connection detected (rediss:// protocol)");
    }

    const tlsOptions = buildTlsOptions(tlsConfiguration);

    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        // Exponential backoff with max 30 seconds
        const delay = Math.min(times * 100, 30000);

        // After several retries, activate fallback mode
        if (times >= 3) {
          handleConnectionFailure(
            new Error(`Connection failed after ${times} retries`)
          );
        }

        return delay;
      },
      lazyConnect: true,
      // Apply TLS options if using rediss:// protocol
      // Requirement: 4.1
      ...(tlsOptions && { tls: tlsOptions }),
    });

    // Handle connection events
    redisClient.on("connect", () => {
      console.log("[Redis] Connected successfully");
      handleConnectionSuccess();
    });

    redisClient.on("ready", () => {
      console.log("[Redis] Ready to accept commands");
      handleConnectionSuccess();
    });

    redisClient.on("error", (err) => {
      // Redact credentials from error messages to prevent leaking sensitive info
      // Requirement: 4.4
      const redactedMessage = redactCredentials(err.message);

      // Handle TLS certificate errors specifically
      // Requirement: 4.3
      if (isTlsCertificateError(err)) {
        console.error(
          "[Redis] TLS certificate validation failed:",
          redactedMessage
        );
        console.error(
          "[Redis] Connection rejected due to certificate error. Check your TLS configuration."
        );
      } else {
        console.error("[Redis] Connection error:", redactedMessage);
      }

      handleConnectionFailure(err);
    });

    redisClient.on("close", () => {
      console.log("[Redis] Connection closed");
      setConnectionState("disconnected");
    });

    redisClient.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
      setConnectionState("connecting");
    });

    redisClient.on("end", () => {
      console.log("[Redis] Connection ended");
      setConnectionState("disconnected");
    });
  }

  return redisClient;
}

/**
 * Close the Redis connection gracefully
 * Should be called during application shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  stopReconnectionTimer();
  connectionChangeCallbacks = [];

  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    setConnectionState("disconnected");
    console.log("[Redis] Connection closed gracefully");
  }
}

/**
 * Check if Redis is connected and available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Get the health status of the Redis connection
 * Includes latency measurement and error information
 * Requirement: 2.1, 2.2, 2.3
 */
export async function getHealthStatus(): Promise<RedisHealthStatus> {
  const startTime = Date.now();
  let connected = false;
  let latencyMs: number | null = null;

  try {
    const client = getRedisClient();
    const result = await client.ping();
    connected = result === "PONG";
    latencyMs = Date.now() - startTime;
  } catch (error) {
    // Redact credentials from error messages
    // Requirement: 4.4
    lastError = redactCredentials(
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  return {
    connected,
    latencyMs,
    lastError,
    lastCheckedAt: new Date().toISOString(),
  };
}

/**
 * Execute a Redis operation with fallback support
 * If Redis is unavailable, activates fallback mode
 * @param operation - The Redis operation to execute
 * @returns The result of the operation or null if failed
 */
export async function executeWithFallback<T>(
  operation: () => Promise<T>
): Promise<{ success: boolean; result: T | null; usedFallback: boolean }> {
  const fallbackManager = getFallbackManager();

  try {
    const result = await operation();
    return { success: true, result, usedFallback: false };
  } catch (error) {
    // Activate fallback mode on failure
    if (!fallbackManager.isInFallbackMode()) {
      handleConnectionFailure(
        error instanceof Error ? error : new Error("Operation failed")
      );
    }

    return { success: false, result: null, usedFallback: true };
  }
}

/**
 * Reset the Redis client state (primarily for testing)
 */
export function resetRedisClient(): void {
  stopReconnectionTimer();
  connectionChangeCallbacks = [];
  connectionState = "disconnected";
  lastError = null;
  tlsConfiguration = undefined;

  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}

// Export the Redis class for type usage
export { Redis };
