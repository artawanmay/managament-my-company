/**
 * Performance Monitor - Track render times and performance metrics
 */

type PerformanceEntry = {
  componentName: string;
  renderTime: number;
  timestamp: number;
};

const performanceLog: PerformanceEntry[] = [];
const MAX_LOG = 200;

/**
 * Measure component render time
 */
export function measureRender<T>(componentName: string, renderFn: () => T): T {
  if (process.env.NODE_ENV !== "development") {
    return renderFn();
  }

  const start = performance.now();
  const result = renderFn();
  const end = performance.now();
  const renderTime = end - start;

  performanceLog.push({
    componentName,
    renderTime,
    timestamp: Date.now(),
  });

  // Keep log bounded
  if (performanceLog.length > MAX_LOG) {
    performanceLog.shift();
  }

  // Warn on slow renders
  if (renderTime > 16) {
    // More than one frame (60fps)
    console.warn(
      `🐢 [SLOW RENDER] ${componentName}: ${renderTime.toFixed(2)}ms`
    );
  }

  return result;
}

/**
 * Start a performance mark
 */
export function startMark(name: string): void {
  if (process.env.NODE_ENV !== "development") return;
  performance.mark(`${name}-start`);
}

/**
 * End a performance mark and log duration
 */
export function endMark(name: string): number {
  if (process.env.NODE_ENV !== "development") return 0;

  performance.mark(`${name}-end`);
  const measure = performance.measure(name, `${name}-start`, `${name}-end`);

  console.log(`⏱️ [PERF] ${name}: ${measure.duration.toFixed(2)}ms`);

  // Cleanup
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);

  return measure.duration;
}

/**
 * Get performance statistics for a component
 */
export function getPerformanceStats(componentName: string): {
  avgRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  renderCount: number;
} | null {
  const entries = performanceLog.filter(
    (e) => e.componentName === componentName
  );

  if (entries.length === 0) return null;

  const times = entries.map((e) => e.renderTime);

  return {
    avgRenderTime: times.reduce((a, b) => a + b, 0) / times.length,
    maxRenderTime: Math.max(...times),
    minRenderTime: Math.min(...times),
    renderCount: entries.length,
  };
}

/**
 * Get all slow renders (> threshold ms)
 */
export function getSlowRenders(thresholdMs: number = 16): PerformanceEntry[] {
  return performanceLog.filter((e) => e.renderTime > thresholdMs);
}

/**
 * Clear performance log
 */
export function clearPerformanceLog(): void {
  performanceLog.length = 0;
}

/**
 * Log performance summary to console
 */
export function logPerformanceSummary(): void {
  if (process.env.NODE_ENV !== "development") return;

  const componentStats = new Map<string, number[]>();

  performanceLog.forEach((entry) => {
    const times = componentStats.get(entry.componentName) || [];
    times.push(entry.renderTime);
    componentStats.set(entry.componentName, times);
  });

  console.group("📊 Performance Summary");
  componentStats.forEach((times, name) => {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    console.log(
      `${name}: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms, count=${times.length}`
    );
  });
  console.groupEnd();
}
