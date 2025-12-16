/**
 * Task API functions
 */
import type {
  TaskListResponse,
  TaskResponse,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  TaskFilters,
} from '../types';

const API_BASE = '/api/tasks';

/**
 * Fetch tasks with filters
 */
export async function fetchTasks(
  filters: TaskFilters = {}
): Promise<TaskListResponse> {
  const params = new URLSearchParams();
  
  if (filters.search) params.set('search', filters.search);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const url = `${API_BASE}?${params.toString()}`;
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch tasks' }));
    throw new Error(error.error || 'Failed to fetch tasks');
  }

  return response.json();
}

/**
 * Fetch a single task by ID
 */
export async function fetchTask(taskId: string): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE}/${taskId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch task' }));
    throw new Error(error.error || 'Failed to fetch task');
  }

  return response.json();
}

/**
 * Create a new task
 */
export async function createTask(
  data: CreateTaskInput,
  csrfToken: string
): Promise<TaskResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create task' }));
    throw new Error(error.error || 'Failed to create task');
  }

  return response.json();
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  data: UpdateTaskInput,
  csrfToken: string
): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE}/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update task' }));
    throw new Error(error.error || 'Failed to update task');
  }

  return response.json();
}

/**
 * Move a task (for Kanban drag-drop)
 */
export async function moveTask(
  taskId: string,
  data: MoveTaskInput,
  csrfToken: string
): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE}/${taskId}/move`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to move task' }));
    throw new Error(error.error || 'Failed to move task');
  }

  return response.json();
}

/**
 * Delete a task
 */
export async function deleteTask(
  taskId: string,
  csrfToken: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/${taskId}`, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete task' }));
    throw new Error(error.error || 'Failed to delete task');
  }

  return response.json();
}
