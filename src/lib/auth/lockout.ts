/**
 * Login lockout service using Redis with in-memory fallback
 * Implements rate limiting for login attempts to prevent brute force attacks
 *
 * Requirements:
 * - 1.1: Fall back to in-memory storage when Redis unavailable
 * - 1.3: Lock account after 5 failed attempts within 15 minutes for 30 minutes
 * - 6.1: Log warning that lockout is not distributed in fallback mode
 * - 6.2: Maintain per-instance lockout state in fallback mode
 * - 6.3: Return accurate local state when querying in fallback mode
 * - 6.4: Do not migrate in-memory state to Redis on reconnection
 * - 18.3: Rate limit login attempts to prevent brute force attacks
 */
import { getRedisClient, isRedisAvailable } from "../realtime/redis";
import { getFallbackManager } from "../realtime/fallback-manager";
import { logInfo, logWarn } from "@/lib/logger";

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes

// Redis key prefixes
const ATTEMPT_KEY_PREFIX = "login:attempts:";
const LOCKOUT_KEY_PREFIX = "login:lockout:";

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
 * Check if we should use fallback mode
 * Returns true if Redis is unavailable or fallback manager is in fallback mode
 */
async function shouldUseFallback(): Promise<boolean> {
  const fallbackManager = getFallbackManager();

  // If already in fallback mode, use fallback
  if (fallbackManager.isInFallbackMode()) {
    return true;
  }

  // Check if Redis is available
  try {
    const available = await isRedisAvailable();
    if (!available) {
      // Activate fallback mode (Requirement 1.1)
      fallbackManager.activateFallback();
      logWarn(
        "[Lockout] Redis unavailable, using in-memory fallback. Lockout is not distributed.",
        {
          mode: "fallback",
        }
      );
      return true;
    }
    return false;
  } catch {
    // On error, activate fallback mode
    fallbackManager.activateFallback();
    logWarn(
      "[Lockout] Redis check failed, using in-memory fallback. Lockout is not distributed.",
      {
        mode: "fallback",
      }
    );
    return true;
  }
}

/**
 * Record a failed login attempt using in-memory fallback store
 * Requirement 6.2: Maintain per-instance lockout state
 */
async function recordFailedAttemptFallback(
  email: string,
  ip: string
): Promise<{ isLocked: boolean; attemptsRemaining: number }> {
  const fallbackManager = getFallbackManager();
  const store = fallbackManager.getStore();
  const attemptKey = getAttemptKey(email);
  const lockoutKey = getLockoutKey(email);

  // Check if already locked (Requirement 6.3)
  if (store.exists(lockoutKey)) {
    return { isLocked: true, attemptsRemaining: 0 };
  }

  // Increment attempt counter
  const attempts = store.incr(attemptKey);

  // Set TTL on first attempt (store doesn't have expire, so we re-set with TTL)
  if (attempts === 1) {
    store.set(attemptKey, "1", ATTEMPT_WINDOW_SECONDS);
  }

  // Check if lockout threshold reached
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    // Set lockout
    store.set(lockoutKey, Date.now().toString(), LOCKOUT_DURATION_SECONDS);
    // Clear attempt counter
    store.del(attemptKey);

    logInfo("[Lockout] Account locked (fallback mode)", {
      email,
      ip,
      mode: "fallback",
    });
    return { isLocked: true, attemptsRemaining: 0 };
  }

  return {
    isLocked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts,
  };
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
  // Check if we should use fallback (Requirement 1.1)
  if (await shouldUseFallback()) {
    return recordFailedAttemptFallback(email, ip);
  }

  const redis = getClient();
  const attemptKey = getAttemptKey(email);
  const lockoutKey = getLockoutKey(email);

  try {
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
      await redis.setex(
        lockoutKey,
        LOCKOUT_DURATION_SECONDS,
        Date.now().toString()
      );
      // Clear attempt counter
      await redis.del(attemptKey);

      logInfo("[Lockout] Account locked", { email, ip });
      return { isLocked: true, attemptsRemaining: 0 };
    }

    return {
      isLocked: false,
      attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts,
    };
  } catch (error) {
    // On Redis error, fall back to in-memory (Requirement 1.1)
    logWarn("[Lockout] Redis operation failed, falling back to in-memory", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    getFallbackManager().activateFallback();
    return recordFailedAttemptFallback(email, ip);
  }
}

/**
 * Check if an email is currently locked out using fallback store
 * Requirement 6.3: Return accurate local state
 */
function isLockedFallback(email: string): boolean {
  const fallbackManager = getFallbackManager();
  const store = fallbackManager.getStore();
  const lockoutKey = getLockoutKey(email);

  return store.exists(lockoutKey);
}

/**
 * Check if an email is currently locked out
 *
 * @param email - The email address to check
 * @returns true if the account is locked, false otherwise
 */
export async function isLocked(email: string): Promise<boolean> {
  // Check if we should use fallback
  if (await shouldUseFallback()) {
    return isLockedFallback(email);
  }

  const redis = getClient();
  const lockoutKey = getLockoutKey(email);

  try {
    const exists = await redis.exists(lockoutKey);
    return exists === 1;
  } catch (error) {
    // On Redis error, fall back to in-memory
    logWarn(
      "[Lockout] Redis operation failed during isLocked check, using fallback",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
    getFallbackManager().activateFallback();
    return isLockedFallback(email);
  }
}

/**
 * Clear all login attempts for an email using fallback store
 */
function clearAttemptsFallback(email: string): void {
  const fallbackManager = getFallbackManager();
  const store = fallbackManager.getStore();
  const attemptKey = getAttemptKey(email);

  store.del(attemptKey);
}

/**
 * Clear all login attempts for an email
 * Should be called after successful login
 *
 * @param email - The email address to clear attempts for
 */
export async function clearAttempts(email: string): Promise<void> {
  // Check if we should use fallback
  if (await shouldUseFallback()) {
    clearAttemptsFallback(email);
    return;
  }

  const redis = getClient();
  const attemptKey = getAttemptKey(email);

  try {
    await redis.del(attemptKey);
  } catch (error) {
    // On Redis error, fall back to in-memory
    logWarn(
      "[Lockout] Redis operation failed during clearAttempts, using fallback",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
    getFallbackManager().activateFallback();
    clearAttemptsFallback(email);
  }
}

/**
 * Get the remaining lockout time using fallback store
 * Note: In-memory store doesn't track TTL directly, so we estimate based on stored timestamp
 */
function getRemainingLockoutTimeFallback(email: string): number {
  const fallbackManager = getFallbackManager();
  const store = fallbackManager.getStore();
  const lockoutKey = getLockoutKey(email);

  const lockoutTimestamp = store.get(lockoutKey);
  if (!lockoutTimestamp) {
    return 0;
  }

  const lockoutTime = parseInt(lockoutTimestamp, 10);
  const elapsed = Math.floor((Date.now() - lockoutTime) / 1000);
  const remaining = LOCKOUT_DURATION_SECONDS - elapsed;

  return remaining > 0 ? remaining : 0;
}

/**
 * Get the remaining lockout time in seconds
 *
 * @param email - The email address to check
 * @returns Remaining lockout time in seconds, or 0 if not locked
 */
export async function getRemainingLockoutTime(email: string): Promise<number> {
  // Check if we should use fallback
  if (await shouldUseFallback()) {
    return getRemainingLockoutTimeFallback(email);
  }

  const redis = getClient();
  const lockoutKey = getLockoutKey(email);

  try {
    const ttl = await redis.ttl(lockoutKey);

    // TTL returns -2 if key doesn't exist, -1 if no TTL set
    if (ttl < 0) {
      return 0;
    }

    return ttl;
  } catch (error) {
    // On Redis error, fall back to in-memory
    logWarn(
      "[Lockout] Redis operation failed during getRemainingLockoutTime, using fallback",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
    getFallbackManager().activateFallback();
    return getRemainingLockoutTimeFallback(email);
  }
}

/**
 * Get the current number of failed attempts using fallback store
 */
function getFailedAttemptCountFallback(email: string): number {
  const fallbackManager = getFallbackManager();
  const store = fallbackManager.getStore();
  const attemptKey = getAttemptKey(email);

  const count = store.get(attemptKey);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Get the current number of failed attempts for an email
 *
 * @param email - The email address to check
 * @returns Number of failed attempts in the current window
 */
export async function getFailedAttemptCount(email: string): Promise<number> {
  // Check if we should use fallback
  if (await shouldUseFallback()) {
    return getFailedAttemptCountFallback(email);
  }

  const redis = getClient();
  const attemptKey = getAttemptKey(email);

  try {
    const count = await redis.get(attemptKey);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    // On Redis error, fall back to in-memory
    logWarn(
      "[Lockout] Redis operation failed during getFailedAttemptCount, using fallback",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
    getFallbackManager().activateFallback();
    return getFailedAttemptCountFallback(email);
  }
}

/**
 * Manually unlock an account using fallback store
 */
function unlockAccountFallback(email: string): void {
  const fallbackManager = getFallbackManager();
  const store = fallbackManager.getStore();
  const lockoutKey = getLockoutKey(email);
  const attemptKey = getAttemptKey(email);

  store.del(lockoutKey);
  store.del(attemptKey);
}

/**
 * Manually unlock an account (admin function)
 *
 * @param email - The email address to unlock
 */
export async function unlockAccount(email: string): Promise<void> {
  // Check if we should use fallback
  if (await shouldUseFallback()) {
    unlockAccountFallback(email);
    return;
  }

  const redis = getClient();
  const lockoutKey = getLockoutKey(email);
  const attemptKey = getAttemptKey(email);

  try {
    await redis.del(lockoutKey);
    await redis.del(attemptKey);
  } catch (error) {
    // On Redis error, fall back to in-memory
    logWarn(
      "[Lockout] Redis operation failed during unlockAccount, using fallback",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
    getFallbackManager().activateFallback();
    unlockAccountFallback(email);
  }
}

// Export constants for testing
export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS,
  ATTEMPT_WINDOW_SECONDS,
  LOCKOUT_DURATION_SECONDS,
} as const;
