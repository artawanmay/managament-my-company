/**
 * Project feature types
 */
import {
  type Project,
  type ProjectStatus,
  type Priority,
  type ProjectMember,
  type ProjectMemberRole,
} from "@/lib/db/schema";

export type {
  Project,
  ProjectStatus,
  Priority,
  ProjectMember,
  ProjectMemberRole,
};

export interface ProjectWithDetails extends Project {
  clientName: string | null;
  managerName: string | null;
  managerEmail: string | null;
  members: ProjectMemberWithUser[];
  canManage: boolean;
}

export interface ProjectListItem {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: Date | null;
  endDate: Date | null;
  managerId: string;
  createdAt: Date;
  updatedAt: Date;
  clientName: string | null;
  managerName: string | null;
}

export interface ProjectMemberWithUser {
  id: string;
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  userRole?: string;
}

export interface ProjectListParams {
  search?: string;
  status?: ProjectStatus;
  priority?: Priority;
  clientId?: string;
  includeArchived?: boolean;
  sortBy?:
    | "name"
    | "status"
    | "priority"
    | "startDate"
    | "endDate"
    | "createdAt"
    | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ProjectListResponse {
  data: ProjectListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateProjectInput {
  clientId: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string | null;
  endDate?: string | null;
  managerId: string;
}

export interface UpdateProjectInput {
  clientId?: string;
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string | null;
  endDate?: string | null;
  managerId?: string;
}

export interface AddMemberInput {
  userId: string;
  role?: ProjectMemberRole;
}
