/**
 * useMoveTask mutation hook with optimistic updates
 * Requirements: 6.2, 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3
 */
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { moveTask } from "../api";
import { tasksQueryKey } from "./use-tasks";
import { useSession } from "@/features/auth/hooks";
import type {
  MoveTaskInput,
  Task,
  TaskListResponse,
  TaskStatus,
} from "../types";

interface MoveTaskParams {
  taskId: string;
  data: MoveTaskInput;
  projectId?: string;
}

interface OptimisticContext {
  previousQueries: Map<string, TaskListResponse | undefined>;
  taskId: string;
  newStatus: TaskStatus;
  newOrder: number;
}

/**
 * Get all task query keys that might contain the task being moved.
 * This handles both filtered (with projectId) and unfiltered queries.
 * Requirements: 2.1, 2.4, 3.1, 3.3
 */
export function getRelevantTaskQueryKeys(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId?: string
): QueryKey[] {
  const queryCache = queryClient.getQueryCache();
  const allQueries = queryCache.getAll();

  // Find all task queries in the cache
  const taskQueryKeys: QueryKey[] = [];

  for (const query of allQueries) {
    const queryKey = query.queryKey;
    // Check if this is a tasks query (starts with 'tasks')
    if (Array.isArray(queryKey) && queryKey[0] === "tasks") {
      taskQueryKeys.push(queryKey);
    }
  }

  // Always include the base unfiltered query key
  const baseKey = tasksQueryKey();
  const hasBaseKey = taskQueryKeys.some(
    (key) => JSON.stringify(key) === JSON.stringify(baseKey)
  );
  if (!hasBaseKey) {
    taskQueryKeys.push(baseKey);
  }

  // If projectId is provided, also include the filtered query key
  if (projectId) {
    const filteredKey = tasksQueryKey({ projectId });
    const hasFilteredKey = taskQueryKeys.some(
      (key) => JSON.stringify(key) === JSON.stringify(filteredKey)
    );
    if (!hasFilteredKey) {
      taskQueryKeys.push(filteredKey);
    }
  }

  return taskQueryKeys;
}

/**
 * Update task in cache data, handling order recalculation
 * Requirements: 2.2 - Maintain correct ordering after optimistic updates
 *
 * Property 5: Order preservation in target column
 * - All tasks originally at positions < P SHALL maintain their positions
 * - The moved task SHALL be at position P
 * - All tasks originally at positions >= P SHALL be shifted to position + 1
 */
export function updateTaskInCache(
  cacheData: TaskListResponse,
  taskId: string,
  newStatus: TaskStatus,
  newOrder: number
): TaskListResponse {
  const tasks = [...cacheData.data];
  const taskIndex = tasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    return cacheData;
  }

  const task = tasks[taskIndex]!;
  const oldStatus = task.status;
  const oldOrder = task.order;

  // Remove task from its current position
  tasks.splice(taskIndex, 1);

  // Handle order recalculation based on whether we're moving within same column or to different column
  if (oldStatus !== newStatus) {
    // Moving to a different column

    // 1. Close the gap in source column: shift tasks that were after the moved task
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i]!.status === oldStatus && tasks[i]!.order > oldOrder) {
        tasks[i] = { ...tasks[i]!, order: tasks[i]!.order - 1 };
      }
    }

    // 2. Make room in target column: shift tasks at or after the new position
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i]!.status === newStatus && tasks[i]!.order >= newOrder) {
        tasks[i] = { ...tasks[i]!, order: tasks[i]!.order + 1 };
      }
    }
  } else {
    // Moving within the same column
    if (newOrder > oldOrder) {
      // Moving down: shift tasks between old and new position up
      for (let i = 0; i < tasks.length; i++) {
        if (
          tasks[i]!.status === oldStatus &&
          tasks[i]!.order > oldOrder &&
          tasks[i]!.order <= newOrder
        ) {
          tasks[i] = { ...tasks[i]!, order: tasks[i]!.order - 1 };
        }
      }
    } else if (newOrder < oldOrder) {
      // Moving up: shift tasks between new and old position down
      for (let i = 0; i < tasks.length; i++) {
        if (
          tasks[i]!.status === oldStatus &&
          tasks[i]!.order >= newOrder &&
          tasks[i]!.order < oldOrder
        ) {
          tasks[i] = { ...tasks[i]!, order: tasks[i]!.order + 1 };
        }
      }
    }
    // If newOrder === oldOrder, no shifting needed
  }

  // Create the updated task with new status and order
  const updatedTask: Task = {
    ...task,
    status: newStatus,
    order: newOrder,
  };

  // Add the updated task back
  tasks.push(updatedTask);

  // Sort tasks by status and then by order for consistent display
  tasks.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status.localeCompare(b.status);
    }
    return a.order - b.order;
  });

  return {
    ...cacheData,
    data: tasks,
  };
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ taskId, data }: MoveTaskParams) => {
      if (!csrfToken) {
        throw new Error("No CSRF token available");
      }
      return moveTask(taskId, data, csrfToken);
    },
    // Optimistic update for smooth drag-drop experience
    // Requirements: 1.1, 1.4, 2.1
    onMutate: async ({
      taskId,
      data,
      projectId,
    }): Promise<OptimisticContext> => {
      // Get all relevant query keys that might contain this task
      const relevantKeys = getRelevantTaskQueryKeys(queryClient, projectId);

      // Cancel all relevant queries to prevent race conditions
      for (const key of relevantKeys) {
        await queryClient.cancelQueries({ queryKey: key });
      }

      // Snapshot all relevant query caches for potential rollback
      const previousQueries = new Map<string, TaskListResponse | undefined>();

      for (const key of relevantKeys) {
        const keyString = JSON.stringify(key);
        const cacheData = queryClient.getQueryData<TaskListResponse>(key);
        previousQueries.set(keyString, cacheData);

        // Update the cache with the new task position
        if (cacheData) {
          const updatedData = updateTaskInCache(
            cacheData,
            taskId,
            data.status,
            data.order
          );
          queryClient.setQueryData<TaskListResponse>(key, updatedData);
        }
      }

      return {
        previousQueries,
        taskId,
        newStatus: data.status,
        newOrder: data.order,
      };
    },
    // On success, keep the optimistic state - no need to invalidate
    // Requirements: 1.2
    onSuccess: () => {
      // Do nothing - optimistic state is already correct
      // This prevents flickering by not triggering a refetch
    },
    // If the mutation fails, rollback all caches to previous state
    // Requirements: 1.3
    onError: (_, __, context) => {
      if (context?.previousQueries) {
        // Restore all snapshots for all filter states
        for (const [keyString, previousData] of context.previousQueries) {
          const key = JSON.parse(keyString) as QueryKey;
          // Restore previous data, or remove the cache entry if it didn't exist before
          if (previousData !== undefined) {
            queryClient.setQueryData(key, previousData);
          } else {
            // If there was no previous data, remove the cache entry
            queryClient.removeQueries({ queryKey: key, exact: true });
          }
        }
      }
    },
    // Only invalidate on error to sync with server state
    // Requirements: 2.3
    onSettled: (_, error, { projectId }) => {
      // Only invalidate if there was an error (to sync with server state after rollback)
      if (error) {
        const relevantKeys = getRelevantTaskQueryKeys(queryClient, projectId);
        for (const key of relevantKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });
}
