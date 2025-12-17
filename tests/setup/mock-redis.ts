/**
 * Mock Redis client for testing
 * Provides an in-memory implementation of Redis operations used by the lockout service
 *
 * Enhanced with:
 * - Connection state tracking
 * - simulateConnectionFailure() method to trigger error state
 * - simulateReconnection() method to restore connection
 *
 * Requirements: 5.1
 */

// In-memory storage
const storage = new Map<string, { value: string; expireAt?: number }>();

// Connection state tracking
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type EventHandler = (...args: unknown[]) => void;

// Global connection state for the mock
let connectionState: ConnectionState = "connected";
let isConnectionFailed = false;

// Event handlers storage
const eventHandlers = new Map<string, EventHandler[]>();

/**
 * Check if a key has expired
 */
function isExpired(key: string): boolean {
  const item = storage.get(key);
  if (!item) return true;
  if (item.expireAt && Date.now() > item.expireAt) {
    storage.delete(key);
    return true;
  }
  return false;
}

/**
 * Throw connection error if connection is failed
 */
function checkConnection(): void {
  if (isConnectionFailed) {
    const error = new Error("Connection is closed");
    (error as NodeJS.ErrnoException).code = "ECONNREFUSED";
    throw error;
  }
}

/**
 * Emit an event to all registered handlers
 */
function emitEvent(event: string, ...args: unknown[]): void {
  const handlers = eventHandlers.get(event) || [];
  for (const handler of handlers) {
    try {
      handler(...args);
    } catch (error) {
      console.error(`[MockRedis] Error in ${event} handler:`, error);
    }
  }
}

/**
 * Mock Redis client implementation
 */
export class MockRedis {
  async get(key: string): Promise<string | null> {
    checkConnection();
    if (isExpired(key)) return null;
    const item = storage.get(key);
    return item?.value ?? null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    checkConnection();
    storage.set(key, { value });
    return "OK";
  }

  async setex(key: string, seconds: number, value: string): Promise<"OK"> {
    checkConnection();
    storage.set(key, {
      value,
      expireAt: Date.now() + seconds * 1000,
    });
    return "OK";
  }

  async incr(key: string): Promise<number> {
    checkConnection();
    if (isExpired(key)) {
      storage.set(key, { value: "1" });
      return 1;
    }
    const item = storage.get(key);
    const newValue = (parseInt(item?.value ?? "0", 10) + 1).toString();
    storage.set(key, { ...item, value: newValue });
    return parseInt(newValue, 10);
  }

  async expire(key: string, seconds: number): Promise<number> {
    checkConnection();
    const item = storage.get(key);
    if (!item) return 0;
    storage.set(key, {
      ...item,
      expireAt: Date.now() + seconds * 1000,
    });
    return 1;
  }

  async exists(key: string): Promise<number> {
    checkConnection();
    if (isExpired(key)) return 0;
    return storage.has(key) ? 1 : 0;
  }

  async del(...keys: string[]): Promise<number> {
    checkConnection();
    let deleted = 0;
    for (const key of keys) {
      if (storage.delete(key)) deleted++;
    }
    return deleted;
  }

  async ttl(key: string): Promise<number> {
    checkConnection();
    if (isExpired(key)) return -2;
    const item = storage.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    return Math.ceil((item.expireAt - Date.now()) / 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    checkConnection();
    // Simple pattern matching for 'login:*' style patterns
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    const result: string[] = [];
    for (const key of storage.keys()) {
      if (!isExpired(key) && regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async ping(): Promise<string> {
    checkConnection();
    return "PONG";
  }

  async quit(): Promise<"OK"> {
    return "OK";
  }

  /**
   * Register an event handler
   * Supports: 'connect', 'ready', 'error', 'close', 'reconnecting', 'end'
   */
  on(event: string, handler: (...args: unknown[]) => void): this {
    const handlers = eventHandlers.get(event) || [];
    handlers.push(handler);
    eventHandlers.set(event, handlers);
    return this;
  }

  /**
   * Remove an event handler
   */
  off(event: string, handler: (...args: unknown[]) => void): this {
    const handlers = eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      eventHandlers.set(event, handlers);
    }
    return this;
  }

  /**
   * Disconnect the mock client
   */
  disconnect(): void {
    connectionState = "disconnected";
    emitEvent("close");
    emitEvent("end");
  }

  /**
   * Connect the mock client
   */
  async connect(): Promise<void> {
    if (isConnectionFailed) {
      const error = new Error("Connection refused");
      (error as NodeJS.ErrnoException).code = "ECONNREFUSED";
      emitEvent("error", error);
      throw error;
    }
    connectionState = "connecting";
    connectionState = "connected";
    emitEvent("connect");
    emitEvent("ready");
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return connectionState;
  }

  /**
   * Check if the mock is in a failed connection state
   */
  isConnectionFailed(): boolean {
    return isConnectionFailed;
  }

  /**
   * Clear all data (useful for test cleanup)
   */
  static clear(): void {
    storage.clear();
  }

  /**
   * Clear all event handlers
   */
  static clearEventHandlers(): void {
    eventHandlers.clear();
  }
}

// Singleton instance
let mockRedisInstance: MockRedis | null = null;

/**
 * Get the mock Redis client instance
 */
export function getMockRedisClient(): MockRedis {
  if (!mockRedisInstance) {
    mockRedisInstance = new MockRedis();
  }
  return mockRedisInstance;
}

/**
 * Reset the mock Redis (clear all data and reset instance)
 */
export function resetMockRedis(): void {
  MockRedis.clear();
  MockRedis.clearEventHandlers();
  connectionState = "connected";
  isConnectionFailed = false;
}

/**
 * Simulate a Redis connection failure
 * This will cause all subsequent Redis operations to throw errors
 * and emit 'error' and 'close' events to registered handlers.
 *
 * Requirement: 5.1
 *
 * @param errorMessage - Optional custom error message
 */
export function simulateConnectionFailure(errorMessage?: string): void {
  isConnectionFailed = true;
  connectionState = "error";

  const error = new Error(errorMessage || "Connection refused");
  (error as NodeJS.ErrnoException).code = "ECONNREFUSED";

  // Emit error event to all registered handlers
  emitEvent("error", error);
  emitEvent("close");
}

/**
 * Simulate Redis reconnection after a failure
 * This will restore normal operation and emit 'connect' and 'ready' events.
 *
 * Requirement: 5.1
 */
export function simulateReconnection(): void {
  isConnectionFailed = false;
  connectionState = "connecting";

  // Emit reconnecting event
  emitEvent("reconnecting");

  // Short delay to simulate reconnection process
  connectionState = "connected";

  // Emit connection success events
  emitEvent("connect");
  emitEvent("ready");
}

/**
 * Get the current connection state of the mock Redis
 */
export function getConnectionState(): ConnectionState {
  return connectionState;
}

/**
 * Check if the mock Redis is in a failed connection state
 */
export function isInFailedState(): boolean {
  return isConnectionFailed;
}
