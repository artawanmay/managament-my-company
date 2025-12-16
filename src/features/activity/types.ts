/**
 * Activity Log Types
 */

export type EntityType = 'CLIENT' | 'PROJECT' | 'TASK' | 'NOTE' | 'FILE' | 'COMMENT' | 'USER';
export type Action = 'CREATED' | 'UPDATED' | 'DELETED' | 'MOVED' | 'ARCHIVED';

export interface ActivityMetadata {
  projectId?: string;
  clientId?: string;
  taskId?: string;
  noteId?: string;
  taskTitle?: string;
  projectName?: string;
  clientName?: string;
  systemName?: string;
  fileName?: string;
  userName?: string;
  userRole?: string;
  fromStatus?: string;
  toStatus?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  [key: string]: unknown;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  entityType: EntityType;
  entityId: string;
  action: Action;
  metadata: ActivityMetadata | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
}

export interface ActivityListResponse {
  data: ActivityLog[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ProjectActivityResponse extends ActivityListResponse {
  projectId: string;
  projectName: string;
}
