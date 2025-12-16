/**
 * Notification Service
 * Provides functions for creating notifications for various event types
 *
 * Requirements:
 * - 9.1: Create notification record with type, title, message, and related data
 * - 9.2: Push notifications to online users via SSE
 * - 20.2: Realtime notification updates
 */
import { db } from '@/lib/db';
import { notifications, type NewNotification, type NotificationType } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import {
  publishNotificationEvent,
  sendToUser,
  type NotificationEvent,
} from '@/lib/realtime';

/**
 * Notification data structure for entity references
 */
export interface NotificationData {
  entityType: 'TASK' | 'PROJECT' | 'COMMENT' | 'CLIENT' | 'NOTE';
  entityId: string;
  projectId?: string;
  taskId?: string;
  actorId?: string;
  actorName?: string;
  [key: string]: unknown;
}

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
}

/**
 * Create a single notification
 * Requirement 9.1: Create notification record with type, title, message, and related data
 * Requirement 9.2: Push notifications to online users via SSE
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ id: string }> {
  const notificationId = randomUUID();
  const notificationData: NewNotification = {
    id: notificationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data ? JSON.stringify(input.data) : null,
  };

  const result = await db.insert(notifications).values(notificationData).returning({ id: notifications.id });

  // Broadcast notification via SSE (Requirement 9.2, 20.2)
  const notificationEvent: NotificationEvent = {
    type: 'NOTIFICATION_CREATED',
    notificationId,
    userId: input.userId,
    data: {
      title: input.title,
      message: input.message,
      notificationType: input.type,
      entityType: input.data?.entityType,
      entityId: input.data?.entityId,
    },
    timestamp: new Date().toISOString(),
  };

  // Broadcast via both Redis pub/sub and direct SSE connections
  try {
    await publishNotificationEvent(input.userId, notificationEvent);
  } catch (err) {
    // Log but don't fail the request if broadcast fails
    console.error('[Notification] Failed to publish notification event:', err);
  }

  // Also send directly to SSE connections (for same-server connections)
  sendToUser(input.userId, 'notification', {
    notificationId,
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    entityType: input.data?.entityType,
    entityId: input.data?.entityId,
    timestamp: new Date().toISOString(),
  });

  return { id: result[0]!.id };
}

/**
 * Create multiple notifications at once (batch insert)
 */
export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<{ count: number }> {
  if (inputs.length === 0) {
    return { count: 0 };
  }

  const notificationData: NewNotification[] = inputs.map((input) => ({
    id: randomUUID(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data ? JSON.stringify(input.data) : null,
  }));

  await db.insert(notifications).values(notificationData);
  return { count: notificationData.length };
}

/**
 * Create a task assigned notification
 * Requirement 9.1: Notification for task assignment
 */
export async function createTaskAssignedNotification(params: {
  assigneeId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  assignerName: string;
  assignerId: string;
}): Promise<{ id: string }> {
  return createNotification({
    userId: params.assigneeId,
    type: 'TASK_ASSIGNED',
    title: 'New task assigned',
    message: `${params.assignerName} assigned you to task: ${params.taskTitle}`,
    data: {
      entityType: 'TASK',
      entityId: params.taskId,
      projectId: params.projectId,
      actorId: params.assignerId,
      actorName: params.assignerName,
    },
  });
}

/**
 * Create a task moved notification
 * Requirement 9.1: Notification for task status change
 */
export async function createTaskMovedNotification(params: {
  userId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  fromStatus: string;
  toStatus: string;
  moverName: string;
  moverId: string;
}): Promise<{ id: string }> {
  return createNotification({
    userId: params.userId,
    type: 'TASK_MOVED',
    title: 'Task status changed',
    message: `${params.moverName} moved task "${params.taskTitle}" from ${params.fromStatus} to ${params.toStatus}`,
    data: {
      entityType: 'TASK',
      entityId: params.taskId,
      projectId: params.projectId,
      actorId: params.moverId,
      actorName: params.moverName,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
    },
  });
}

/**
 * Create a comment added notification
 * Requirement 9.1: Notification for new comment
 */
export async function createCommentAddedNotification(params: {
  userId: string;
  commentId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  commenterName: string;
  commenterId: string;
}): Promise<{ id: string }> {
  return createNotification({
    userId: params.userId,
    type: 'COMMENT_ADDED',
    title: 'New comment on task',
    message: `${params.commenterName} commented on task: ${params.taskTitle}`,
    data: {
      entityType: 'COMMENT',
      entityId: params.commentId,
      taskId: params.taskId,
      projectId: params.projectId,
      actorId: params.commenterId,
      actorName: params.commenterName,
    },
  });
}

/**
 * Create a mentioned notification
 * Requirement 9.1: Notification for @mention
 */
export async function createMentionedNotification(params: {
  userId: string;
  commentId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  mentionerName: string;
  mentionerId: string;
}): Promise<{ id: string }> {
  return createNotification({
    userId: params.userId,
    type: 'MENTIONED',
    title: 'You were mentioned',
    message: `${params.mentionerName} mentioned you in a comment on task: ${params.taskTitle}`,
    data: {
      entityType: 'COMMENT',
      entityId: params.commentId,
      taskId: params.taskId,
      projectId: params.projectId,
      actorId: params.mentionerId,
      actorName: params.mentionerName,
    },
  });
}

/**
 * Create a deadline approaching notification
 * Requirement 9.1: Notification for upcoming deadline
 */
export async function createDeadlineApproachingNotification(params: {
  userId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  dueDate: Date;
  daysRemaining: number;
}): Promise<{ id: string }> {
  const daysText = params.daysRemaining === 1 ? '1 day' : `${params.daysRemaining} days`;
  return createNotification({
    userId: params.userId,
    type: 'DEADLINE_APPROACHING',
    title: 'Deadline approaching',
    message: `Task "${params.taskTitle}" is due in ${daysText}`,
    data: {
      entityType: 'TASK',
      entityId: params.taskId,
      projectId: params.projectId,
      dueDate: params.dueDate.toISOString(),
      daysRemaining: params.daysRemaining,
    },
  });
}
