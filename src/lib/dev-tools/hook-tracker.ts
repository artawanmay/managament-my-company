/**
 * Hook Tracker - Track hook calls and state changes
 */

type HookCall = {
  hookName: string;
  componentName: string;
  timestamp: number;
  value?: unknown;
  previousValue?: unknown;
};

const hookHistory: HookCall[] = [];
const MAX_HISTORY = 100;

/**
 * Track a hook call with its value
 */
export function trackHook(
  hookName: string,
  componentName: string,
  value?: unknown,
  previousValue?: unknown
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const call: HookCall = {
    hookName,
    componentName,
    timestamp: Date.now(),
    value,
    previousValue,
  };

  hookHistory.push(call);
  
  // Keep history bounded
  if (hookHistory.length > MAX_HISTORY) {
    hookHistory.shift();
  }

  // Log state changes
  if (previousValue !== undefined && value !== previousValue) {
    console.log(
      `🪝 [${hookName}] ${componentName}:`,
      '\n  Previous:', previousValue,
      '\n  Current:', value
    );
  }
}

/**
 * Create a tracked useState wrapper
 */
export function createTrackedState<T>(
  componentName: string,
  stateName: string,
  useState: (initial: T) => [T, (value: T | ((prev: T) => T)) => void]
) {
  return (initial: T): [T, (value: T | ((prev: T) => T)) => void] => {
    const [state, setState] = useState(initial);
    
    const trackedSetState = (value: T | ((prev: T) => T)) => {
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(state)
        : value;
      
      trackHook(`useState:${stateName}`, componentName, newValue, state);
      setState(value);
    };

    return [state, trackedSetState];
  };
}

/**
 * Log useEffect execution
 */
export function trackEffect(
  componentName: string,
  effectName: string,
  deps?: unknown[]
): void {
  if (process.env.NODE_ENV !== 'development') return;

  console.log(
    `⚡ [useEffect] ${componentName}:${effectName}`,
    deps ? `deps: ${JSON.stringify(deps)}` : 'no deps'
  );
}

/**
 * Get hook call history
 */
export function getHookHistory(): HookCall[] {
  return [...hookHistory];
}

/**
 * Clear hook history
 */
export function clearHookHistory(): void {
  hookHistory.length = 0;
}

/**
 * Find rapid hook calls (potential loop indicator)
 */
export function findRapidHookCalls(
  hookName: string,
  threshold: number = 10,
  timeWindow: number = 1000
): HookCall[] {
  const now = Date.now();
  const recentCalls = hookHistory.filter(
    call => call.hookName === hookName && now - call.timestamp < timeWindow
  );
  
  if (recentCalls.length >= threshold) {
    console.warn(
      `⚠️ [RAPID CALLS] ${hookName} called ${recentCalls.length} times in ${timeWindow}ms`
    );
  }
  
  return recentCalls;
}
