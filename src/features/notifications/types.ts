/**
 * Notifications feature types
 * Requirements: 9.1, 9.3, 9.4, 9.5
 */

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_MOVED'
  | 'COMMENT_ADDED'
  | 'MENTIONED'
  | 'DEADLINE_APPROACHING';

export interface NotificationData {
  entityType?: 'TASK' | 'PROJECT' | 'COMMENT' | 'CLIENT' | 'NOTE';
  entityId?: string;
  projectId?: string;
  taskId?: string;
  actorId?: string;
  actorName?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationsListResponse {
  data: Notification[];
  unreadCount: number;
  totalCount: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface MarkAsReadResponse {
  success: boolean;
  data?: Notification;
}

export interface MarkAllAsReadResponse {
  success: boolean;
  markedCount: number;
}
