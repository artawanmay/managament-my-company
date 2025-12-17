/**
 * Property-based tests for view mode persistence
 * Tests view mode round trip and default fallback behavior
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

const PBT_RUNS = 100;

/**
 * View mode type for tasks display
 */
type ViewMode = 'list' | 'kanban';

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
function getStoredViewMode(storage: Storage): ViewMode {
  try {
    const stored = storage.getItem(TASKS_VIEW_MODE_KEY);
    if (stored && isValidViewMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_VIEW_MODE;
}

/**
 * Save view mode to localStorage
 */
function saveViewMode(storage: Storage, mode: ViewMode): void {
  try {
    storage.setItem(TASKS_VIEW_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
}

/**
 * Create a mock localStorage for testing
 */
function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(key => delete store[key]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

describe('View Mode Persistence Properties', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  /**
   * **Feature: tasks-view-persistence, Property 1: View Mode Round Trip Persistence**
   * *For any* valid view mode ('list' or 'kanban'), saving it to localStorage
   * and then restoring it SHALL return the same view mode value.
   * **Validates: Requirements 1.1, 1.2**
   */
  it('Property 1: View Mode Round Trip Persistence - save and restore returns same value', async () => {
    const viewModeArb = fc.constantFrom<ViewMode>('list', 'kanban');

    await fc.assert(
      fc.asyncProperty(
        viewModeArb,
        async (viewMode) => {
          // Clear storage before each test
          mockStorage.clear();

          // Save the view mode
          saveViewMode(mockStorage, viewMode);

          // Restore the view mode
          const restored = getStoredViewMode(mockStorage);

          // The restored value should match the saved value
          return restored === viewMode;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: tasks-view-persistence, Property 1: View Mode Round Trip Persistence**
   * Multiple saves should preserve the last saved value
   * **Validates: Requirements 1.1, 1.2**
   */
  it('Property 1: View Mode Round Trip Persistence - multiple saves preserve last value', async () => {
    const viewModeArb = fc.constantFrom<ViewMode>('list', 'kanban');

    await fc.assert(
      fc.asyncProperty(
        fc.array(viewModeArb, { minLength: 1, maxLength: 10 }),
        async (viewModes) => {
          // Clear storage before each test
          mockStorage.clear();

          // Save multiple view modes
          for (const mode of viewModes) {
            saveViewMode(mockStorage, mode);
          }

          // Restore the view mode
          const restored = getStoredViewMode(mockStorage);

          // The restored value should match the last saved value
          const lastSaved = viewModes[viewModes.length - 1];
          return restored === lastSaved;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

describe('View Mode Default Fallback Properties', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  /**
   * **Feature: tasks-view-persistence, Property 2: Default View Mode Fallback**
   * *For any* initial state where localStorage does not contain a saved view mode,
   * the system SHALL return 'list' as the default view mode.
   * **Validates: Requirements 1.3**
   */
  it('Property 2: Default View Mode Fallback - empty localStorage returns list default', () => {
    // Storage is empty
    const restored = getStoredViewMode(mockStorage);

    // Should return default 'list'
    expect(restored).toBe('list');
  });

  /**
   * **Feature: tasks-view-persistence, Property 2: Default View Mode Fallback**
   * Invalid stored values should fallback to 'list' default
   * **Validates: Requirements 1.3**
   */
  it('Property 2: Default View Mode Fallback - invalid values return list default', async () => {
    // Generate arbitrary strings that are NOT valid view modes
    const invalidValueArb = fc.string().filter(s => !VALID_VIEW_MODES.includes(s as ViewMode));

    await fc.assert(
      fc.asyncProperty(
        invalidValueArb,
        async (invalidValue) => {
          // Clear and set invalid value directly
          mockStorage.clear();
          mockStorage.setItem(TASKS_VIEW_MODE_KEY, invalidValue);

          // Restore the view mode
          const restored = getStoredViewMode(mockStorage);

          // Should return default 'list' for invalid values
          return restored === 'list';
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: tasks-view-persistence, Property 2: Default View Mode Fallback**
   * Storage key should be consistent
   * **Validates: Requirements 1.4**
   */
  it('Property 2: Default View Mode Fallback - uses consistent storage key', () => {
    // Save a view mode
    saveViewMode(mockStorage, 'kanban');

    // Verify it's stored under the correct key
    const storedValue = mockStorage.getItem(TASKS_VIEW_MODE_KEY);
    expect(storedValue).toBe('kanban');

    // Verify the key is 'tasks-view-mode'
    expect(TASKS_VIEW_MODE_KEY).toBe('tasks-view-mode');
  });
});
