/**
 * Circuit Breaker Hook for Async Operations
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 * State machine: Closed → Open → HalfOpen → Closed
 *
 * Requirements: 7.2, 7.3
 */
import { useState, useCallback, useRef, useEffect } from "react";

export interface CircuitBreakerConfig {
  /** Maximum failures before opening circuit (default: 3) */
  maxFailures: number;
  /** Time in ms before attempting to close circuit (default: 30000) */
  resetTimeMs: number;
  /** Callback when circuit opens */
  onOpen?: () => void;
  /** Callback when circuit closes */
  onClose?: () => void;
  /** Callback when circuit enters half-open state */
  onHalfOpen?: () => void;
}

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerState {
  /** Current circuit state */
  state: CircuitState;
  /** Whether the circuit is open (blocking operations) */
  isOpen: boolean;
  /** Current failure count */
  failureCount: number;
  /** Timestamp of last failure */
  lastFailureTime: number | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxFailures: 3,
  resetTimeMs: 30000,
};

export interface CircuitBreakerResult {
  /** Current circuit breaker state */
  state: CircuitBreakerState;
  /** Execute an async operation through the circuit breaker */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Manually record a failure */
  recordFailure: () => void;
  /** Manually record a success */
  recordSuccess: () => void;
  /** Reset the circuit breaker to closed state */
  reset: () => void;
}

/**
 * Hook implementing the circuit breaker pattern for async operations
 *
 * @param name - Identifier for this circuit breaker (for logging)
 * @param config - Optional configuration overrides
 * @returns Circuit breaker state and control methods
 */
export function useCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreakerResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxFailures, resetTimeMs, onOpen, onClose, onHalfOpen } =
    mergedConfig;

  const [circuitState, setCircuitState] = useState<CircuitState>("closed");
  const [failureCount, setFailureCount] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState<number | null>(null);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  // Transition to open state
  const openCircuit = useCallback(() => {
    console.warn(
      `🔴 [CIRCUIT BREAKER] ${name}: Circuit OPENED after ${maxFailures} failures`
    );
    setCircuitState("open");
    onOpen?.();

    // Schedule transition to half-open
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      console.info(
        `🟡 [CIRCUIT BREAKER] ${name}: Circuit entering HALF-OPEN state`
      );
      setCircuitState("half-open");
      onHalfOpen?.();
    }, resetTimeMs);
  }, [name, maxFailures, resetTimeMs, onOpen, onHalfOpen]);

  // Record a failure
  const recordFailure = useCallback(() => {
    const now = Date.now();
    setLastFailureTime(now);

    setFailureCount((prev) => {
      const newCount = prev + 1;
      console.warn(
        `⚠️ [CIRCUIT BREAKER] ${name}: Failure recorded (${newCount}/${maxFailures})`
      );

      if (newCount >= maxFailures && circuitState === "closed") {
        openCircuit();
      } else if (circuitState === "half-open") {
        // Failure in half-open state reopens the circuit
        openCircuit();
      }

      return newCount;
    });
  }, [name, maxFailures, circuitState, openCircuit]);

  // Record a success
  const recordSuccess = useCallback(() => {
    if (circuitState === "half-open") {
      console.info(
        `🟢 [CIRCUIT BREAKER] ${name}: Circuit CLOSED after successful operation`
      );
      setCircuitState("closed");
      setFailureCount(0);
      setLastFailureTime(null);
      onClose?.();

      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    }
  }, [name, circuitState, onClose]);

  // Reset the circuit breaker
  const reset = useCallback(() => {
    console.info(`🔄 [CIRCUIT BREAKER] ${name}: Circuit manually RESET`);
    setCircuitState("closed");
    setFailureCount(0);
    setLastFailureTime(null);

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    onClose?.();
  }, [name, onClose]);

  // Execute an async operation through the circuit breaker
  const execute = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      if (circuitState === "open") {
        const error = new Error(`Circuit breaker is open for ${name}`);
        console.error(
          `🚫 [CIRCUIT BREAKER] ${name}: Operation blocked - circuit is OPEN`
        );
        throw error;
      }

      try {
        const result = await fn();
        recordSuccess();
        return result;
      } catch (error) {
        recordFailure();
        throw error;
      }
    },
    [name, circuitState, recordSuccess, recordFailure]
  );

  return {
    state: {
      state: circuitState,
      isOpen: circuitState === "open",
      failureCount,
      lastFailureTime,
    },
    execute,
    recordFailure,
    recordSuccess,
    reset,
  };
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker is open for ${name}`);
    this.name = "CircuitBreakerOpenError";
  }
}
