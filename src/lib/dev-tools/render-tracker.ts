/**
 * Render Tracker - Track component re-renders and detect infinite loops
 */

type RenderInfo = {
  count: number;
  timestamps: number[];
  lastProps?: unknown;
};

const renderCounts = new Map<string, RenderInfo>();
const LOOP_THRESHOLD = 50; // Max renders in time window
const TIME_WINDOW = 1000; // 1 second window

/**
 * Track component renders and detect potential infinite loops
 * @param componentName - Name of the component being tracked
 * @param props - Current props (optional, for comparison)
 */
export function trackRender(componentName: string, props?: unknown): void {
  if (process.env.NODE_ENV !== 'development') return;

  const now = Date.now();
  const info = renderCounts.get(componentName) || { count: 0, timestamps: [] };
  
  // Clean old timestamps outside time window
  info.timestamps = info.timestamps.filter(t => now - t < TIME_WINDOW);
  info.timestamps.push(now);
  info.count++;

  // Detect potential infinite loop
  if (info.timestamps.length >= LOOP_THRESHOLD) {
    console.error(
      `🔴 [LOOP DETECTED] ${componentName} rendered ${info.timestamps.length} times in ${TIME_WINDOW}ms!`,
      '\nProps:', props,
      '\nPrevious props:', info.lastProps
    );
    // Optionally throw to break the loop
    // throw new Error(`Infinite loop detected in ${componentName}`);
  }

  info.lastProps = props;
  renderCounts.set(componentName, info);
}

/**
 * Log render with timing info
 */
export function logRender(componentName: string, reason?: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const info = renderCounts.get(componentName);
  console.log(
    `🔄 [RENDER] ${componentName}`,
    `(#${info?.count || 1})`,
    reason ? `- ${reason}` : '',
    new Date().toISOString()
  );
}

/**
 * Get render statistics for a component
 */
export function getRenderStats(componentName: string): RenderInfo | undefined {
  return renderCounts.get(componentName);
}

/**
 * Reset render tracking (useful for tests)
 */
export function resetRenderTracking(): void {
  renderCounts.clear();
}

/**
 * Get all render statistics
 */
export function getAllRenderStats(): Map<string, RenderInfo> {
  return new Map(renderCounts);
}
