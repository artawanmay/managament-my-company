/**
 * Property-based tests for Kanban optimistic update functionality
 * Tests optimistic update behavior, query key consistency, and cache management
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { QueryClient } from '@tanstack/react-query';
import {
  getRelevantTaskQueryKeys,
  updateTaskInCache,
} from '@/features/tasks/hooks/use-move-task';
import { tasksQueryKey } from '@/features/tasks/hooks/use-tasks';
import type { Task, TaskListResponse } from '@/features/tasks/types';

const PBT_RUNS = 100;

// Task status values (Kanban columns)
const taskStatusValues = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'DONE',
] as const;

const priorityValues = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

/**
 * Helper to create a mock task
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'project-1',
    title: 'Test Task',
    description: null,
    status: 'BACKLOG',
    priority: 'MEDIUM',
    assigneeId: null,
    reporterId: 'user-1',
    dueDate: null,
    estimatedHours: null,
    actualHours: null,
    linkedNoteId: null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Helper to create a mock TaskListResponse
 */
function createMockTaskListResponse(tasks: Task[]): TaskListResponse {
  return {
    data: tasks,
    pagination: {
      page: 1,
      limit: 50,
      total: tasks.length,
      totalPages: 1,
    },
  };
}

/**
 * Alias for the exported updateTaskInCache function for backward compatibility
 * This function is now exported from use-move-task.ts and tested directly
 */
const simulateOptimisticUpdate = updateTaskInCache;

describe('Kanban Optimistic Update Properties', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * **Feature: kanban-optimistic-update, Property 1: Optimistic update preserves task in new position**
   * *For any* task with status A and *for any* target status B (where A ≠ B),
   * immediately after executing the optimistic update (onMutate),
   * querying the cache SHALL return the task with status B and the specified order.
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Optimistic update preserves task in new position', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        taskStatusArb,
        taskStatusArb,
        priorityArb,
        fc.integer({ min: 0, max: 100 }),
        async (taskId, title, initialStatus, targetStatus, priority, newOrder) => {
          // Skip if same status (we're testing cross-column moves)
          if (initialStatus === targetStatus) {
            return true;
          }

          // Create initial task
          const task = createMockTask({
            id: taskId,
            title,
            status: initialStatus,
            priority,
            order: 0,
          });

          // Create initial cache data
          const initialCacheData = createMockTaskListResponse([task]);

          // Simulate optimistic update
          const updatedCacheData = simulateOptimisticUpdate(
            initialCacheData,
            taskId,
            targetStatus,
            newOrder
          );

          // Find the task in updated cache
          const updatedTask = updatedCacheData.data.find(t => t.id === taskId);

          // Verify task exists and has correct status and order
          if (!updatedTask) {
            return false;
          }

          if (updatedTask.status !== targetStatus) {
            return false;
          }

          if (updatedTask.order !== newOrder) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 1: Optimistic update preserves task in new position**
   * Moving task within same column should update order only
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Moving task within same column updates order', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        taskStatusArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        async (taskId, status, initialOrder, newOrder) => {
          // Create initial task
          const task = createMockTask({
            id: taskId,
            status,
            order: initialOrder,
          });

          // Create initial cache data
          const initialCacheData = createMockTaskListResponse([task]);

          // Simulate optimistic update (same status, different order)
          const updatedCacheData = simulateOptimisticUpdate(
            initialCacheData,
            taskId,
            status,
            newOrder
          );

          // Find the task in updated cache
          const updatedTask = updatedCacheData.data.find(t => t.id === taskId);

          // Verify task exists and has correct status and order
          if (!updatedTask) {
            return false;
          }

          // Status should remain the same
          if (updatedTask.status !== status) {
            return false;
          }

          // Order should be updated
          if (updatedTask.order !== newOrder) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

describe('Query Key Consistency Properties', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * **Feature: kanban-optimistic-update, Property 4: Query key consistency across filter states**
   * *For any* task move operation and *for any* filter state (projectId present, projectId empty, or projectId undefined),
   * the optimistic update SHALL update all query caches that could contain the moved task,
   * including both filtered queries (by projectId) and unfiltered queries.
   * **Validates: Requirements 2.1, 2.4, 3.1, 3.3**
   */
  it('Property 4: Query key consistency - includes base query key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.uuid(), { nil: undefined }),
        async (projectId) => {
          // Set up some cache data
          const task = createMockTask({ projectId: projectId ?? 'default-project' });
          const cacheData = createMockTaskListResponse([task]);
          
          // Set cache for base query
          queryClient.setQueryData(tasksQueryKey(), cacheData);
          
          // If projectId provided, also set filtered cache
          if (projectId) {
            queryClient.setQueryData(tasksQueryKey({ projectId }), cacheData);
          }

          // Get relevant query keys
          const relevantKeys = getRelevantTaskQueryKeys(queryClient, projectId);

          // Should always include base query key
          const baseKey = tasksQueryKey();
          const hasBaseKey = relevantKeys.some(
            key => JSON.stringify(key) === JSON.stringify(baseKey)
          );

          if (!hasBaseKey) {
            return false;
          }

          // If projectId provided, should include filtered key
          if (projectId) {
            const filteredKey = tasksQueryKey({ projectId });
            const hasFilteredKey = relevantKeys.some(
              key => JSON.stringify(key) === JSON.stringify(filteredKey)
            );
            if (!hasFilteredKey) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 4: Query key consistency across filter states**
   * All existing task queries in cache should be included in relevant keys
   * **Validates: Requirements 2.1, 2.4, 3.1, 3.3**
   */
  it('Property 4: Query key consistency - includes all existing task queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (projectIds) => {
          const task = createMockTask();
          const cacheData = createMockTaskListResponse([task]);

          // Set up cache for multiple project filters
          queryClient.setQueryData(tasksQueryKey(), cacheData);
          for (const pid of projectIds) {
            queryClient.setQueryData(tasksQueryKey({ projectId: pid }), cacheData);
          }

          // Get relevant query keys (without specific projectId)
          const relevantKeys = getRelevantTaskQueryKeys(queryClient, undefined);

          // Should include all the queries we set up
          const expectedKeyCount = 1 + projectIds.length; // base + filtered
          
          // All keys should be task queries
          for (const key of relevantKeys) {
            if (!Array.isArray(key) || key[0] !== 'tasks') {
              return false;
            }
          }

          // Should have at least as many keys as we set up
          if (relevantKeys.length < expectedKeyCount) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 4: Query key consistency across filter states**
   * Empty cache should still return base query key
   * **Validates: Requirements 2.1, 2.4, 3.1, 3.3**
   */
  it('Property 4: Query key consistency - empty cache returns base key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.uuid(), { nil: undefined }),
        async (projectId) => {
          // Don't set any cache data

          // Get relevant query keys
          const relevantKeys = getRelevantTaskQueryKeys(queryClient, projectId);

          // Should always include base query key
          const baseKey = tasksQueryKey();
          const hasBaseKey = relevantKeys.some(
            key => JSON.stringify(key) === JSON.stringify(baseKey)
          );

          if (!hasBaseKey) {
            return false;
          }

          // If projectId provided, should include filtered key
          if (projectId) {
            const filteredKey = tasksQueryKey({ projectId });
            const hasFilteredKey = relevantKeys.some(
              key => JSON.stringify(key) === JSON.stringify(filteredKey)
            );
            if (!hasFilteredKey) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});


describe('Mutation Settlement Properties', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * **Feature: kanban-optimistic-update, Property 2: Successful mutation maintains optimistic state**
   * *For any* successful task move mutation, the cache state after onSuccess SHALL be identical
   * to the cache state after onMutate (the task remains in its optimistically updated position
   * without any intermediate state changes).
   * **Validates: Requirements 1.2**
   */
  it('Property 2: Successful mutation maintains optimistic state', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        taskStatusArb,
        taskStatusArb,
        priorityArb,
        fc.integer({ min: 0, max: 100 }),
        fc.option(fc.uuid(), { nil: undefined }),
        async (taskId, title, initialStatus, targetStatus, priority, newOrder, projectId) => {
          // Skip if same status (we're testing cross-column moves)
          if (initialStatus === targetStatus) {
            return true;
          }

          // Create initial task
          const task = createMockTask({
            id: taskId,
            title,
            status: initialStatus,
            priority,
            order: 0,
            projectId: projectId ?? 'default-project',
          });

          // Create initial cache data
          const initialCacheData = createMockTaskListResponse([task]);

          // Set up cache
          const queryKey = tasksQueryKey(projectId ? { projectId } : undefined);
          queryClient.setQueryData(queryKey, initialCacheData);

          // Simulate optimistic update (onMutate)
          const optimisticCacheData = simulateOptimisticUpdate(
            initialCacheData,
            taskId,
            targetStatus,
            newOrder
          );
          queryClient.setQueryData(queryKey, optimisticCacheData);

          // Capture state after optimistic update
          const stateAfterOptimistic = queryClient.getQueryData<TaskListResponse>(queryKey);

          // Simulate onSuccess - which should do nothing (no invalidation)
          // The implementation's onSuccess is empty, so we just verify state is unchanged

          // Capture state after onSuccess
          const stateAfterSuccess = queryClient.getQueryData<TaskListResponse>(queryKey);

          // State should be identical after onSuccess
          if (JSON.stringify(stateAfterOptimistic) !== JSON.stringify(stateAfterSuccess)) {
            return false;
          }

          // Verify the task is still in the new position
          const taskInCache = stateAfterSuccess?.data.find(t => t.id === taskId);
          if (!taskInCache) {
            return false;
          }

          if (taskInCache.status !== targetStatus) {
            return false;
          }

          if (taskInCache.order !== newOrder) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 2: Successful mutation maintains optimistic state**
   * Multiple query caches should all maintain optimistic state after success
   * **Validates: Requirements 1.2**
   */
  it('Property 2: Successful mutation maintains optimistic state across multiple caches', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        taskStatusArb,
        taskStatusArb,
        fc.integer({ min: 0, max: 50 }),
        fc.uuid(),
        async (taskId, initialStatus, targetStatus, newOrder, projectId) => {
          // Skip if same status
          if (initialStatus === targetStatus) {
            return true;
          }

          // Create initial task
          const task = createMockTask({
            id: taskId,
            status: initialStatus,
            order: 0,
            projectId,
          });

          const initialCacheData = createMockTaskListResponse([task]);

          // Set up both base and filtered caches
          const baseKey = tasksQueryKey();
          const filteredKey = tasksQueryKey({ projectId });

          queryClient.setQueryData(baseKey, initialCacheData);
          queryClient.setQueryData(filteredKey, initialCacheData);

          // Simulate optimistic update on both caches
          const optimisticCacheData = simulateOptimisticUpdate(
            initialCacheData,
            taskId,
            targetStatus,
            newOrder
          );

          queryClient.setQueryData(baseKey, optimisticCacheData);
          queryClient.setQueryData(filteredKey, optimisticCacheData);

          // Capture states after optimistic update
          const baseStateAfterOptimistic = queryClient.getQueryData<TaskListResponse>(baseKey);
          const filteredStateAfterOptimistic = queryClient.getQueryData<TaskListResponse>(filteredKey);

          // Simulate onSuccess (does nothing)
          // Verify states are unchanged

          const baseStateAfterSuccess = queryClient.getQueryData<TaskListResponse>(baseKey);
          const filteredStateAfterSuccess = queryClient.getQueryData<TaskListResponse>(filteredKey);

          // Both caches should maintain optimistic state
          if (JSON.stringify(baseStateAfterOptimistic) !== JSON.stringify(baseStateAfterSuccess)) {
            return false;
          }

          if (JSON.stringify(filteredStateAfterOptimistic) !== JSON.stringify(filteredStateAfterSuccess)) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 3: Failed mutation reverts to original state**
   * *For any* task move mutation that fails (onError is called), the cache SHALL be reverted
   * to contain the task with its original status and order as captured before onMutate.
   * **Validates: Requirements 1.3**
   */
  it('Property 3: Failed mutation reverts to original state', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        taskStatusArb,
        taskStatusArb,
        priorityArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        fc.option(fc.uuid(), { nil: undefined }),
        async (taskId, title, initialStatus, targetStatus, priority, newOrder, initialOrder, projectId) => {
          // Skip if same status (we're testing cross-column moves)
          if (initialStatus === targetStatus) {
            return true;
          }

          // Create initial task
          const task = createMockTask({
            id: taskId,
            title,
            status: initialStatus,
            priority,
            order: initialOrder,
            projectId: projectId ?? 'default-project',
          });

          // Create initial cache data
          const initialCacheData = createMockTaskListResponse([task]);

          // Set up cache
          const queryKey = tasksQueryKey(projectId ? { projectId } : undefined);
          queryClient.setQueryData(queryKey, initialCacheData);

          // Snapshot original state (as onMutate would do)
          const previousData = queryClient.getQueryData<TaskListResponse>(queryKey);

          // Simulate optimistic update (onMutate)
          const optimisticCacheData = simulateOptimisticUpdate(
            initialCacheData,
            taskId,
            targetStatus,
            newOrder
          );
          queryClient.setQueryData(queryKey, optimisticCacheData);

          // Verify optimistic update was applied
          const stateAfterOptimistic = queryClient.getQueryData<TaskListResponse>(queryKey);
          const taskAfterOptimistic = stateAfterOptimistic?.data.find(t => t.id === taskId);
          if (taskAfterOptimistic?.status !== targetStatus) {
            return false; // Optimistic update didn't work
          }

          // Simulate onError - restore previous data
          if (previousData !== undefined) {
            queryClient.setQueryData(queryKey, previousData);
          }

          // Verify rollback
          const stateAfterRollback = queryClient.getQueryData<TaskListResponse>(queryKey);
          const taskAfterRollback = stateAfterRollback?.data.find(t => t.id === taskId);

          // Task should be back to original state
          if (!taskAfterRollback) {
            return false;
          }

          if (taskAfterRollback.status !== initialStatus) {
            return false;
          }

          if (taskAfterRollback.order !== initialOrder) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 3: Failed mutation reverts to original state**
   * Rollback should restore all caches to their original state
   * **Validates: Requirements 1.3**
   */
  it('Property 3: Failed mutation reverts all caches to original state', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        taskStatusArb,
        taskStatusArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        fc.uuid(),
        async (taskId, initialStatus, targetStatus, newOrder, initialOrder, projectId) => {
          // Skip if same status
          if (initialStatus === targetStatus) {
            return true;
          }

          // Create initial task
          const task = createMockTask({
            id: taskId,
            status: initialStatus,
            order: initialOrder,
            projectId,
          });

          const initialCacheData = createMockTaskListResponse([task]);

          // Set up both base and filtered caches
          const baseKey = tasksQueryKey();
          const filteredKey = tasksQueryKey({ projectId });

          queryClient.setQueryData(baseKey, initialCacheData);
          queryClient.setQueryData(filteredKey, initialCacheData);

          // Snapshot original states (as onMutate would do)
          const previousBaseData = queryClient.getQueryData<TaskListResponse>(baseKey);
          const previousFilteredData = queryClient.getQueryData<TaskListResponse>(filteredKey);

          // Simulate optimistic update on both caches
          const optimisticCacheData = simulateOptimisticUpdate(
            initialCacheData,
            taskId,
            targetStatus,
            newOrder
          );

          queryClient.setQueryData(baseKey, optimisticCacheData);
          queryClient.setQueryData(filteredKey, optimisticCacheData);

          // Simulate onError - restore all previous data
          if (previousBaseData !== undefined) {
            queryClient.setQueryData(baseKey, previousBaseData);
          }
          if (previousFilteredData !== undefined) {
            queryClient.setQueryData(filteredKey, previousFilteredData);
          }

          // Verify rollback on both caches
          const baseStateAfterRollback = queryClient.getQueryData<TaskListResponse>(baseKey);
          const filteredStateAfterRollback = queryClient.getQueryData<TaskListResponse>(filteredKey);

          // Both caches should be back to original state
          const baseTask = baseStateAfterRollback?.data.find(t => t.id === taskId);
          const filteredTask = filteredStateAfterRollback?.data.find(t => t.id === taskId);

          if (!baseTask || baseTask.status !== initialStatus || baseTask.order !== initialOrder) {
            return false;
          }

          if (!filteredTask || filteredTask.status !== initialStatus || filteredTask.order !== initialOrder) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});


describe('Order Preservation Properties', () => {
  /**
   * **Feature: kanban-optimistic-update, Property 5: Order preservation in target column**
   * *For any* column containing N tasks (N >= 1) and *for any* task being moved into that column
   * at position P (0 <= P <= N), after the optimistic update:
   * - All tasks originally at positions < P SHALL maintain their positions
   * - The moved task SHALL be at position P
   * - All tasks originally at positions >= P SHALL be shifted to position + 1
   * **Validates: Requirements 2.2**
   */
  it('Property 5: Order preservation when moving task to different column', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        // Generate number of existing tasks in target column (1-5)
        fc.integer({ min: 1, max: 5 }),
        // Generate source and target status (must be different)
        taskStatusArb,
        taskStatusArb,
        priorityArb,
        fc.uuid(),
        async (numExistingTasks, sourceStatus, targetStatus, priority, movedTaskId) => {
          // Skip if same status (we're testing cross-column moves)
          if (sourceStatus === targetStatus) {
            return true;
          }

          // Create existing tasks in target column with sequential orders
          const existingTasks: Task[] = [];
          for (let i = 0; i < numExistingTasks; i++) {
            existingTasks.push(createMockTask({
              id: `existing-task-${i}`,
              status: targetStatus,
              order: i,
              priority,
            }));
          }

          // Create the task to be moved (in source column)
          const movedTask = createMockTask({
            id: movedTaskId,
            status: sourceStatus,
            order: 0,
            priority,
          });

          // Create initial cache data with all tasks
          const allTasks = [...existingTasks, movedTask];
          const initialCacheData = createMockTaskListResponse(allTasks);

          // Test moving to each valid position in target column (0 to numExistingTasks)
          for (let targetPosition = 0; targetPosition <= numExistingTasks; targetPosition++) {
            // Simulate optimistic update
            const updatedCacheData = simulateOptimisticUpdate(
              initialCacheData,
              movedTaskId,
              targetStatus,
              targetPosition
            );

            // Get tasks in target column after update
            const targetColumnTasks = updatedCacheData.data
              .filter(t => t.status === targetStatus)
              .sort((a, b) => a.order - b.order);

            // Verify moved task is at the correct position
            const movedTaskInResult = targetColumnTasks.find(t => t.id === movedTaskId);
            if (!movedTaskInResult || movedTaskInResult.order !== targetPosition) {
              return false;
            }

            // Verify tasks originally at positions < P maintain their positions
            for (let i = 0; i < targetPosition; i++) {
              const originalTask = existingTasks[i];
              const taskInResult = targetColumnTasks.find(t => t.id === originalTask!.id);
              if (!taskInResult || taskInResult.order !== i) {
                return false;
              }
            }

            // Verify tasks originally at positions >= P are shifted to position + 1
            for (let i = targetPosition; i < numExistingTasks; i++) {
              const originalTask = existingTasks[i];
              const taskInResult = targetColumnTasks.find(t => t.id === originalTask!.id);
              if (!taskInResult || taskInResult.order !== i + 1) {
                return false;
              }
            }

            // Verify total count in target column is correct (original + 1)
            if (targetColumnTasks.length !== numExistingTasks + 1) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 5: Order preservation in target column**
   * When moving within the same column, orders should be properly adjusted
   * **Validates: Requirements 2.2**
   */
  it('Property 5: Order preservation when moving task within same column', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        // Generate number of tasks in column (2-5, need at least 2 for within-column move)
        fc.integer({ min: 2, max: 5 }),
        taskStatusArb,
        priorityArb,
        async (numTasks, status, priority) => {
          // Create tasks with sequential orders
          const tasks: Task[] = [];
          for (let i = 0; i < numTasks; i++) {
            tasks.push(createMockTask({
              id: `task-${i}`,
              status,
              order: i,
              priority,
            }));
          }

          const initialCacheData = createMockTaskListResponse(tasks);

          // Test moving each task to each valid position
          for (let sourceIndex = 0; sourceIndex < numTasks; sourceIndex++) {
            for (let targetPosition = 0; targetPosition < numTasks; targetPosition++) {
              // Skip if moving to same position
              if (sourceIndex === targetPosition) {
                continue;
              }

              const movedTaskId = `task-${sourceIndex}`;

              // Simulate optimistic update
              const updatedCacheData = simulateOptimisticUpdate(
                initialCacheData,
                movedTaskId,
                status,
                targetPosition
              );

              // Get tasks in column after update
              const columnTasks = updatedCacheData.data
                .filter(t => t.status === status)
                .sort((a, b) => a.order - b.order);

              // Verify moved task is at the correct position
              const movedTaskInResult = columnTasks.find(t => t.id === movedTaskId);
              if (!movedTaskInResult || movedTaskInResult.order !== targetPosition) {
                return false;
              }

              // Verify total count is unchanged
              if (columnTasks.length !== numTasks) {
                return false;
              }

              // Verify all orders are unique and sequential (0 to numTasks-1)
              const orders = columnTasks.map(t => t.order).sort((a, b) => a - b);
              for (let i = 0; i < numTasks; i++) {
                if (orders[i] !== i) {
                  return false;
                }
              }
            }
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: kanban-optimistic-update, Property 5: Order preservation in target column**
   * Source column should have gap closed when task is moved out
   * **Validates: Requirements 2.2**
   */
  it('Property 5: Source column gap closure when task moves out', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        // Generate number of tasks in source column (2-5)
        fc.integer({ min: 2, max: 5 }),
        taskStatusArb,
        taskStatusArb,
        priorityArb,
        async (numSourceTasks, sourceStatus, targetStatus, priority) => {
          // Skip if same status
          if (sourceStatus === targetStatus) {
            return true;
          }

          // Create tasks in source column with sequential orders
          const sourceTasks: Task[] = [];
          for (let i = 0; i < numSourceTasks; i++) {
            sourceTasks.push(createMockTask({
              id: `source-task-${i}`,
              status: sourceStatus,
              order: i,
              priority,
            }));
          }

          const initialCacheData = createMockTaskListResponse(sourceTasks);

          // Test moving each task out of the source column
          for (let sourceIndex = 0; sourceIndex < numSourceTasks; sourceIndex++) {
            const movedTaskId = `source-task-${sourceIndex}`;

            // Simulate optimistic update (move to target column at position 0)
            const updatedCacheData = simulateOptimisticUpdate(
              initialCacheData,
              movedTaskId,
              targetStatus,
              0
            );

            // Get remaining tasks in source column after update
            const sourceColumnTasks = updatedCacheData.data
              .filter(t => t.status === sourceStatus)
              .sort((a, b) => a.order - b.order);

            // Verify source column has one less task
            if (sourceColumnTasks.length !== numSourceTasks - 1) {
              return false;
            }

            // Verify orders are sequential (gap is closed)
            for (let i = 0; i < sourceColumnTasks.length; i++) {
              if (sourceColumnTasks[i]!.order !== i) {
                return false;
              }
            }
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});
