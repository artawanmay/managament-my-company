/**
 * Mock Redis client for testing
 * Provides an in-memory implementation of Redis operations used by the lockout service
 */

// In-memory storage
const storage = new Map<string, { value: string; expireAt?: number }>();

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
 * Mock Redis client implementation
 */
export class MockRedis {
  async get(key: string): Promise<string | null> {
    if (isExpired(key)) return null;
    const item = storage.get(key);
    return item?.value ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    storage.set(key, { value });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    storage.set(key, {
      value,
      expireAt: Date.now() + seconds * 1000,
    });
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    if (isExpired(key)) {
      storage.set(key, { value: '1' });
      return 1;
    }
    const item = storage.get(key);
    const newValue = (parseInt(item?.value ?? '0', 10) + 1).toString();
    storage.set(key, { ...item, value: newValue });
    return parseInt(newValue, 10);
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = storage.get(key);
    if (!item) return 0;
    storage.set(key, {
      ...item,
      expireAt: Date.now() + seconds * 1000,
    });
    return 1;
  }

  async exists(key: string): Promise<number> {
    if (isExpired(key)) return 0;
    return storage.has(key) ? 1 : 0;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (storage.delete(key)) deleted++;
    }
    return deleted;
  }

  async ttl(key: string): Promise<number> {
    if (isExpired(key)) return -2;
    const item = storage.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    return Math.ceil((item.expireAt - Date.now()) / 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    // Simple pattern matching for 'login:*' style patterns
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const result: string[] = [];
    for (const key of storage.keys()) {
      if (!isExpired(key) && regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  on(_event: string, _handler: (...args: unknown[]) => void): this {
    // No-op for mock
    return this;
  }

  /**
   * Clear all data (useful for test cleanup)
   */
  static clear(): void {
    storage.clear();
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
}
