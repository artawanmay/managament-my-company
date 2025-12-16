/**
 * Dashboard Types
 * Types for dashboard data and API responses
 */

export interface ClientCounts {
  total: number;
  active: number;
  inactive: number;
  prospect: number;
}

export interface ProjectCounts {
  total: number;
  planning: number;
  active: number;
  onHold: number;
  completed: number;
  archived: number;
}

export interface TaskCounts {
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  inReview: number;
  changesRequested: number;
  done: number;
}

export interface OverdueByProject {
  projectId: string;
  projectName: string;
  count: number;
}

export interface OverdueCounts {
  total: number;
  byProject: OverdueByProject[];
}

export interface DashboardData {
  clients: ClientCounts;
  projects: ProjectCounts;
  tasks: TaskCounts;
  overdue: OverdueCounts;
}

export interface DashboardResponse {
  data: DashboardData;
}
