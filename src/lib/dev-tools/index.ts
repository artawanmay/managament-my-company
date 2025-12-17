/**
 * Development Tools - Error & Loop Tracking
 * 
 * This module provides utilities for debugging React applications:
 * - Component render tracking
 * - Hook call tracking
 * - Performance monitoring
 * - Error boundary helpers
 * 
 * Usage:
 * ```tsx
 * import { useRenderTracker, useLoopDetector } from '@/lib/dev-tools';
 * 
 * function MyComponent(props) {
 *   useRenderTracker('MyComponent', props, true); // verbose mode
 *   useLoopDetector('MyComponent');
 *   // ... rest of component
 * }
 * ```
 */

export * from './render-tracker';
export * from './hook-tracker';
export * from './performance-monitor';
export * from './use-render-tracker';
