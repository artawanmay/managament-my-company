/**
 * React Hook for render tracking
 * Use this in components to automatically track renders
 */
import { useEffect, useRef } from 'react';
import { trackRender, logRender } from './render-tracker';

/**
 * Hook to track component renders
 * @param componentName - Name of the component
 * @param props - Component props for comparison
 * @param verbose - Log every render
 */
export function useRenderTracker(
  componentName: string,
  props?: Record<string, unknown>,
  verbose: boolean = false
): void {
  const renderCount = useRef(0);
  const prevProps = useRef<Record<string, unknown> | undefined>();

  renderCount.current++;
  trackRender(componentName, props);

  if (verbose) {
    logRender(componentName);
  }

  useEffect(() => {
    if (props && prevProps.current) {
      // Find changed props
      const changedProps: string[] = [];
      const allKeys = new Set([
        ...Object.keys(props),
        ...Object.keys(prevProps.current),
      ]);

      allKeys.forEach(key => {
        if (props[key] !== prevProps.current?.[key]) {
          changedProps.push(key);
        }
      });

      if (changedProps.length > 0 && verbose) {
        console.log(
          `📝 [PROPS CHANGED] ${componentName}:`,
          changedProps.join(', ')
        );
      }
    }

    prevProps.current = props;
  });
}

/**
 * Hook to detect and warn about rapid re-renders
 */
export function useLoopDetector(
  componentName: string,
  threshold: number = 20
): void {
  const renderTimestamps = useRef<number[]>([]);
  const TIME_WINDOW = 1000;

  const now = Date.now();
  renderTimestamps.current = renderTimestamps.current.filter(
    t => now - t < TIME_WINDOW
  );
  renderTimestamps.current.push(now);

  if (renderTimestamps.current.length >= threshold) {
    console.error(
      `🔴 [LOOP WARNING] ${componentName} rendered ${renderTimestamps.current.length} times in ${TIME_WINDOW}ms!`
    );
  }
}
