/**
 * Safe State Hook with Rate Limiting and Debouncing
 *
 * This hook provides a safer alternative to useState that:
 * - Debounces rapid state changes (configurable, default 100ms)
 * - Rate limits updates (max updates per second)
 * - Logs warnings when rate limit is exceeded
 *
 * Requirements: 9.1, 9.2
 */
import { useState, useCallback, useRef, useEffect } from "react";

export interface SafeStateConfig {
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number;
  /** Maximum updates allowed per second (default: 10) */
  maxUpdatesPerSecond?: number;
  /** Callback when rate limit is exceeded */
  onRateLimitExceeded?: (info: RateLimitInfo) => void;
  /** Enable debouncing (default: true) */
  enableDebounce?: boolean;
  /** Enable rate limiting (default: true) */
  enableRateLimit?: boolean;
}

export interface RateLimitInfo {
  /** Number of updates attempted in the current window */
  updateCount: number;
  /** Maximum allowed updates per second */
  maxUpdates: number;
  /** Timestamp when rate limit was exceeded */
  timestamp: number;
  /** Name/identifier for debugging */
  name?: string;
}

export interface SafeStateResult {
  /** Whether rate limit is currently active */
  isRateLimited: boolean;
  /** Number of updates in current window */
  updateCount: number;
  /** Reset rate limit counter */
  resetRateLimit: () => void;
}

const DEFAULT_CONFIG: Required<Omit<SafeStateConfig, "onRateLimitExceeded">> = {
  debounceMs: 100,
  maxUpdatesPerSecond: 10,
  enableDebounce: true,
  enableRateLimit: true,
};

/**
 * Hook providing safe state management with debouncing and rate limiting
 *
 * @param initialValue - Initial state value
 * @param config - Optional configuration
 * @param name - Optional name for debugging
 * @returns Tuple of [state, setState, metadata]
 */
export function useSafeState<T>(
  initialValue: T | (() => T),
  config?: SafeStateConfig,
  name?: string
): [T, (value: T | ((prev: T) => T)) => void, SafeStateResult] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { debounceMs, maxUpdatesPerSecond, enableDebounce, enableRateLimit } =
    mergedConfig;
  const onRateLimitExceeded = config?.onRateLimitExceeded;

  // Actual state
  const [state, setStateInternal] = useState<T>(initialValue);

  // Rate limiting tracking
  const updateTimestamps = useRef<number[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Debounce tracking
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | ((prev: T) => T) | null>(null);
  const hasPendingUpdate = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Clean old timestamps and check rate limit
  const checkRateLimit = useCallback((): boolean => {
    if (!enableRateLimit) return false;

    const now = Date.now();
    const windowMs = 1000; // 1 second window

    // Remove timestamps older than 1 second
    updateTimestamps.current = updateTimestamps.current.filter(
      (t) => now - t < windowMs
    );

    const currentCount = updateTimestamps.current.length;

    if (currentCount >= maxUpdatesPerSecond) {
      if (!isRateLimited) {
        const info: RateLimitInfo = {
          updateCount: currentCount,
          maxUpdates: maxUpdatesPerSecond,
          timestamp: now,
          name,
        };

        console.warn(
          `⚠️ [SAFE STATE] ${name || "Unknown"}: Rate limit exceeded!`,
          `\n  Updates: ${currentCount}/${maxUpdatesPerSecond} per second`,
          `\n  Debounce: ${debounceMs}ms`
        );

        onRateLimitExceeded?.(info);
        setIsRateLimited(true);
      }
      return true;
    }

    if (isRateLimited) {
      setIsRateLimited(false);
    }
    return false;
  }, [
    enableRateLimit,
    maxUpdatesPerSecond,
    isRateLimited,
    name,
    debounceMs,
    onRateLimitExceeded,
  ]);

  // Apply state update
  const applyUpdate = useCallback((value: T | ((prev: T) => T)) => {
    // Record timestamp for rate limiting
    updateTimestamps.current.push(Date.now());

    setStateInternal(value);
  }, []);

  // Main setState function with debouncing and rate limiting
  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      // Check rate limit first
      if (checkRateLimit()) {
        // Store pending value but don't apply yet
        pendingValueRef.current = value;
        hasPendingUpdate.current = true;

        // Schedule retry after rate limit window
        if (!debounceTimerRef.current) {
          debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            if (hasPendingUpdate.current && pendingValueRef.current !== null) {
              const pending = pendingValueRef.current;
              hasPendingUpdate.current = false;
              pendingValueRef.current = null;
              setState(pending); // Retry
            }
          }, debounceMs);
        }
        return;
      }

      // Apply debouncing if enabled
      if (enableDebounce) {
        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Store pending value
        pendingValueRef.current = value;
        hasPendingUpdate.current = true;

        // Schedule debounced update
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          if (hasPendingUpdate.current && pendingValueRef.current !== null) {
            const pending = pendingValueRef.current;
            hasPendingUpdate.current = false;
            pendingValueRef.current = null;
            applyUpdate(pending);
          }
        }, debounceMs);
      } else {
        // No debouncing, apply immediately
        applyUpdate(value);
      }
    },
    [checkRateLimit, enableDebounce, debounceMs, applyUpdate]
  );

  // Reset rate limit counter
  const resetRateLimit = useCallback(() => {
    updateTimestamps.current = [];
    setIsRateLimited(false);
    hasPendingUpdate.current = false;
    pendingValueRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  return [
    state,
    setState,
    {
      isRateLimited,
      updateCount: updateTimestamps.current.length,
      resetRateLimit,
    },
  ];
}

/**
 * Immediate state setter that bypasses debouncing
 * Useful for critical updates that must happen immediately
 */
export function useSafeStateImmediate<T>(
  initialValue: T | (() => T),
  config?: Omit<SafeStateConfig, "enableDebounce">,
  name?: string
): [T, (value: T | ((prev: T) => T)) => void, SafeStateResult] {
  return useSafeState(initialValue, { ...config, enableDebounce: false }, name);
}
