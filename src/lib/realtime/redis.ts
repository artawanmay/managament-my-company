/**
 * Redis client connection management
 * Used for realtime pub/sub and rate limiting (login lockout)
 */
import Redis from 'ioredis';

// Redis connection URL from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton Redis client instance
let redisClient: Redis | null = null;

/**
 * Get or create the Redis client instance
 * Uses lazy initialization to avoid connection issues during module loading
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        // Exponential backoff with max 30 seconds
        const delay = Math.min(times * 100, 30000);
        return delay;
      },
      lazyConnect: true,
    });

    // Handle connection events
    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed');
    });
  }

  return redisClient;
}

/**
 * Close the Redis connection gracefully
 * Should be called during application shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed gracefully');
  }
}

/**
 * Check if Redis is connected and available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// Export the Redis class for type usage
export { Redis };
