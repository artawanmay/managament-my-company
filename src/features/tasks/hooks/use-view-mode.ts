import { useState, useCallback, useEffect } from 'react';

/**
 * View mode type for tasks display
 */
export type ViewMode = 'list' | 'kanban';

/**
 * Storage key for persisting view mode preference
 */
const TASKS_VIEW_MODE_KEY = 'tasks-view-mode';

/**
 * Default view mode when no preference is stored
 */
const DEFAULT_VIEW_MODE: ViewMode = 'list';

/**
 * Valid view mode values for validation
 */
const VALID_VIEW_MODES: ViewMode[] = ['list', 'kanban'];

/**
 * Check if a value is a valid ViewMode
 */
function isValidViewMode(value: unknown): value is ViewMode {
  return typeof value === 'string' && VALID_VIEW_MODES.includes(value as ViewMode);
}

/**
 * Read view mode from localStorage with fallback
 */
function getStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(TASKS_VIEW_MODE_KEY);
    if (stored && isValidViewMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available (e.g., private browsing)
  }
  return DEFAULT_VIEW_MODE;
}

/**
 * Save view mode to localStorage
 */
function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(TASKS_VIEW_MODE_KEY, mode);
  } catch {
    // localStorage not available (e.g., private browsing)
  }
}

export interface UseViewModeReturn {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

/**
 * Custom hook for managing tasks view mode with localStorage persistence
 * 
 * @returns Object containing current viewMode and setViewMode function
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export function useViewMode(): UseViewModeReturn {
  const [viewMode, setViewModeState] = useState<ViewMode>(getStoredViewMode);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    saveViewMode(mode);
  }, []);

  // Sync with localStorage on mount (handles SSR hydration)
  useEffect(() => {
    const stored = getStoredViewMode();
    if (stored !== viewMode) {
      setViewModeState(stored);
    }
  }, []);

  return { viewMode, setViewMode };
}
