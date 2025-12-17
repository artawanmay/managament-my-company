/**
 * Enhanced Render Tracker with Circuit Breaker
 *
 * This hook tracks component renders and implements a circuit breaker
 * that halts renders when the threshold is exceeded to prevent infinite loops.
 *
 * Requirements: 1.4, 1.5
 */
import { useRef, useCallback } from "react";

export interface RenderTrackerConfig {
  /** Maximum render count before circuit breaker triggers (default: 50) */
  maxRenderCount: number;
  /** Time window in milliseconds for counting renders (default: 1000) */
  timeWindowMs: number;
  /** Callback when threshold is exceeded */
  onThresholdExceeded?: (info: RenderInfo) => void;
  /** Enable circuit breaker to halt renders (default: true) */
  enableCircuitBreaker: boolean;
}

export interface RenderInfo {
  componentName: string;
  renderCount: number;
  timeWindow: number;
  lastRenderTime: number;
  stackTrace?: string;
}

interface RenderTrackerState {
  renderCount: number;
  isBlocked: boolean;
}

const DEFAULT_CONFIG: RenderTrackerConfig = {
  maxRenderCount: 50,
  timeWindowMs: 1000,
  enableCircuitBreaker: true,
};

// Global registry to track blocked components
const blockedComponents = new Set<string>();

/**
 * Get stack trace for debugging
 */
function getStackTrace(): string {
  try {
    throw new Error("Stack trace");
  } catch (e) {
    return (e as Error).stack || "";
  }
}

/**
 * Hook to track component renders with circuit breaker protection
 *
 * @param componentName - Name of the component being tracked
 * @param config - Optional configuration overrides
 * @returns Object with renderCount, isBlocked status, and reset function
 */
export function useRenderTrackerSafe(
  componentName: string,
  config?: Partial<RenderTrackerConfig>
): RenderTrackerState & { reset: () => void } {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    maxRenderCount,
    timeWindowMs,
    onThresholdExceeded,
    enableCircuitBreaker,
  } = mergedConfig;

  // Track render timestamps within the time window
  const renderTimestamps = useRef<number[]>([]);
  const isBlockedRef = useRef(blockedComponents.has(componentName));

  // Get current time
  const now = Date.now();

  // Clean old timestamps outside time window
  renderTimestamps.current = renderTimestamps.current.filter(
    (t) => now - t < timeWindowMs
  );

  // Add current render timestamp
  renderTimestamps.current.push(now);

  const currentRenderCount = renderTimestamps.current.length;

  // Check if threshold exceeded
  if (currentRenderCount >= maxRenderCount && !isBlockedRef.current) {
    const renderInfo: RenderInfo = {
      componentName,
      renderCount: currentRenderCount,
      timeWindow: timeWindowMs,
      lastRenderTime: now,
      stackTrace: getStackTrace(),
    };

    // Log error with component name and stack trace
    console.error(
      `🛑 [CIRCUIT BREAKER] ${componentName} exceeded render threshold!`,
      `\n  Renders: ${currentRenderCount} in ${timeWindowMs}ms`,
      `\n  Threshold: ${maxRenderCount}`,
      `\n  Stack trace:`,
      renderInfo.stackTrace
    );

    // Call callback if provided
    if (onThresholdExceeded) {
      onThresholdExceeded(renderInfo);
    }

    // Block component if circuit breaker is enabled
    if (enableCircuitBreaker) {
      blockedComponents.add(componentName);
      isBlockedRef.current = true;
    }
  }

  // Reset function to unblock component
  const reset = useCallback(() => {
    blockedComponents.delete(componentName);
    isBlockedRef.current = false;
    renderTimestamps.current = [];
  }, [componentName]);

  return {
    renderCount: currentRenderCount,
    isBlocked: isBlockedRef.current,
    reset,
  };
}

/**
 * Check if a component is currently blocked by circuit breaker
 */
export function isComponentBlocked(componentName: string): boolean {
  return blockedComponents.has(componentName);
}

/**
 * Reset all blocked components (useful for tests)
 */
export function resetAllBlockedComponents(): void {
  blockedComponents.clear();
}

/**
 * Get all currently blocked components
 */
export function getBlockedComponents(): string[] {
  return Array.from(blockedComponents);
}
