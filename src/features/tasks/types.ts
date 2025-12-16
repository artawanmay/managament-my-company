/**
 * Task feature types
 */

export const TASK_STATUS_VALUES = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'DONE',
] as const;

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITY_VALUES)[number];

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  linkedNoteId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  projectName?: string;
  assigneeName?: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  reporter?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  isOverdue?: boolean;
}

export interface TaskListResponse {
  data: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TaskResponse {
  data: Task;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  linkedNoteId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  linkedNoteId?: string | null;
}

export interface MoveTaskInput {
  status: TaskStatus;
  order: number;
}

export interface TaskFilters {
  search?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  sortBy?: 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt' | 'order';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Kanban column configuration
export const KANBAN_COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'BACKLOG', title: 'Backlog', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'TODO', title: 'To Do', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'bg-purple-50 dark:bg-purple-900/20' },
  { id: 'CHANGES_REQUESTED', title: 'Changes Requested', color: 'bg-orange-50 dark:bg-orange-900/20' },
  { id: 'DONE', title: 'Done', color: 'bg-green-50 dark:bg-green-900/20' },
];

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};
