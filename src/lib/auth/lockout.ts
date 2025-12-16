/**
 * Login lockout service using Redis
 * Implements rate limiting for login attempts to prevent brute force attacks
 *
 * Requirements:
 * - 1.3: Lock account after 5 failed attempts within 15 minutes for 30 minutes
 * - 18.3: Rate limit login attempts to prevent brute force attacks
 */
import { getRedisClient } from '../realtime/redis';
import { logInfo } from '@/lib/logger';

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes

// Redis key prefixes
const ATTEMPT_KEY_PREFIX = 'login:attempts:';
const LOCKOUT_KEY_PREFIX = 'login:lockout:';

// Redis client interface for dependency injection (testing)
interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  exists(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

// Allow injecting a custom Redis client for testing
let customRedisClient: RedisLike | null = null;

/**
 * Set a custom Redis client (for testing)
 */
export function setRedisClient(client: RedisLike | null): void {
  customRedisClient = client;
}

/**
 * Get the Redis client (custom or default)
 */
function getClient(): RedisLike {
  return customRedisClient || getRedisClient();
}

/**
 * Generate a unique key for tracking login attempts
 * Uses email to track attempts per user
 */
function getAttemptKey(email: string): string {
  return `${ATTEMPT_KEY_PREFIX}${email.toLowerCase()}`;
}

/**
 * Generate a unique key for lockout status
 */
function getLockoutKey(email: string): string {
  return `${LOCKOUT_KEY_PREFIX}${email.toLowerCase()}`;
}

/**
 * Record a failed login attempt
 * Increments the attempt counter and sets TTL for the attempt window
 * If max attempts reached, triggers lockout
 *
 * @param email - The email address that failed login
 * @param ip - The IP address of the request (for logging purposes)
 */
export async function recordFailedAttempt(
  email: string,
  ip: string
): Promise<{ isLocked: boolean; attemptsRemaining: number }> {
  const redis = getClient();
  const attemptKey = getAttemptKey(email);
  const lockoutKey = getLockoutKey(email);

  // Check if already locked
  const isCurrentlyLocked = await redis.exists(lockoutKey);
  if (isCurrentlyLocked) {
    return { isLocked: true, attemptsRemaining: 0 };
  }

  // Increment attempt counter
  const attempts = await redis.incr(attemptKey);

  // Set TTL on first attempt
  if (attempts === 1) {
    await redis.expire(attemptKey, ATTEMPT_WINDOW_SECONDS);
  }

  // Check if lockout threshold reached
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    // Set lockout
    await redis.setex(lockoutKey, LOCKOUT_DURATION_SECONDS, Date.now().toString());
    // Clear attempt counter
    await redis.del(attemptKey);

    logInfo('[Lockout] Account locked', { email, ip });
    return { isLocked: true, attemptsRemaining: 0 };
  }

  return {
    isLocked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts,
  };
}

/**
 * Check if an email is currently locked out
 *
 * @param email - The email address to check
 * @returns true if the account is locked, false otherwise
 */
export async function isLocked(email: string): Promise<boolean> {
  const redis = getClient();
  const lockoutKey = getLockoutKey(email);

  const exists = await redis.exists(lockoutKey);
  return exists === 1;
}

/**
 * Clear all login attempts for an email
 * Should be called after successful login
 *
 * @param email - The email address to clear attempts for
 */
export async function clearAttempts(email: string): Promise<void> {
  const redis = getClient();
  const attemptKey = getAttemptKey(email);

  await redis.del(attemptKey);
}

/**
 * Get the remaining lockout time in seconds
 *
 * @param email - The email address to check
 * @returns Remaining lockout time in seconds, or 0 if not locked
 */
export async function getRemainingLockoutTime(email: string): Promise<number> {
  const redis = getClient();
  const lockoutKey = getLockoutKey(email);

  const ttl = await redis.ttl(lockoutKey);

  // TTL returns -2 if key doesn't exist, -1 if no TTL set
  if (ttl < 0) {
    return 0;
  }

  return ttl;
}

/**
 * Get the current number of failed attempts for an email
 *
 * @param email - The email address to check
 * @returns Number of failed attempts in the current window
 */
export async function getFailedAttemptCount(email: string): Promise<number> {
  const redis = getClient();
  const attemptKey = getAttemptKey(email);

  const count = await redis.get(attemptKey);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Manually unlock an account (admin function)
 *
 * @param email - The email address to unlock
 */
export async function unlockAccount(email: string): Promise<void> {
  const redis = getClient();
  const lockoutKey = getLockoutKey(email);
  const attemptKey = getAttemptKey(email);

  await redis.del(lockoutKey);
  await redis.del(attemptKey);
}

// Export constants for testing
export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS,
  ATTEMPT_WINDOW_SECONDS,
  LOCKOUT_DURATION_SECONDS,
} as const;
