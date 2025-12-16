/**
 * Activity Log Service
 * Provides functions for logging significant actions in the system
 *
 * Requirements:
 * - 10.1: Log actor, entity type, entity ID, action, metadata, and timestamp
 */
import { db } from '@/lib/db';
import { activityLogs, type NewActivityLog, type EntityType, type Action } from '@/lib/db/schema';
import { randomUUID } from 'crypto';

/**
 * Metadata structure for activity logs
 */
export interface ActivityMetadata {
  previousValue?: unknown;
  newValue?: unknown;
  changes?: Record<string, { from: unknown; to: unknown }>;
  projectId?: string;
  clientId?: string;
  taskId?: string;
  noteId?: string;
  [key: string]: unknown;
}

/**
 * Input for creating an activity log entry
 */
export interface LogActivityInput {
  actorId: string;
  entityType: EntityType;
  entityId: string;
  action: Action;
  metadata?: ActivityMetadata;
}

/**
 * Log a significant action in the system
 * Requirement 10.1: Log actor, entity type, entity ID, action, metadata, and timestamp
 */
export async function logActivity(input: LogActivityInput): Promise<{ id: string }> {
  const activityId = randomUUID();
  const activityData: NewActivityLog = {
    id: activityId,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  };

  const result = await db.insert(activityLogs).values(activityData).returning({ id: activityLogs.id });
  return { id: result[0]!.id };
}

/**
 * Log multiple activities at once (batch insert)
 */
export async function logActivities(inputs: LogActivityInput[]): Promise<{ count: number }> {
  if (inputs.length === 0) {
    return { count: 0 };
  }

  const activityData: NewActivityLog[] = inputs.map((input) => ({
    id: randomUUID(),
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  }));

  await db.insert(activityLogs).values(activityData);
  return { count: activityData.length };
}

// Convenience functions for common activity types

/**
 * Log client creation
 */
export async function logClientCreated(actorId: string, clientId: string, clientName: string): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'CLIENT',
    entityId: clientId,
    action: 'CREATED',
    metadata: { clientName },
  });
}

/**
 * Log client update
 */
export async function logClientUpdated(
  actorId: string,
  clientId: string,
  changes: Record<string, { from: unknown; to: unknown }>
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'CLIENT',
    entityId: clientId,
    action: 'UPDATED',
    metadata: { changes },
  });
}

/**
 * Log client deletion
 */
export async function logClientDeleted(actorId: string, clientId: string, clientName: string): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'CLIENT',
    entityId: clientId,
    action: 'DELETED',
    metadata: { clientName },
  });
}

/**
 * Log project creation
 */
export async function logProjectCreated(
  actorId: string,
  projectId: string,
  projectName: string,
  clientId?: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'PROJECT',
    entityId: projectId,
    action: 'CREATED',
    metadata: { projectName, clientId },
  });
}

/**
 * Log project update
 */
export async function logProjectUpdated(
  actorId: string,
  projectId: string,
  changes: Record<string, { from: unknown; to: unknown }>
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'PROJECT',
    entityId: projectId,
    action: 'UPDATED',
    metadata: { changes },
  });
}

/**
 * Log project archival
 */
export async function logProjectArchived(actorId: string, projectId: string, projectName: string): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'PROJECT',
    entityId: projectId,
    action: 'ARCHIVED',
    metadata: { projectName },
  });
}

/**
 * Log task creation
 */
export async function logTaskCreated(
  actorId: string,
  taskId: string,
  taskTitle: string,
  projectId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'TASK',
    entityId: taskId,
    action: 'CREATED',
    metadata: { taskTitle, projectId },
  });
}

/**
 * Log task update
 */
export async function logTaskUpdated(
  actorId: string,
  taskId: string,
  projectId: string,
  changes: Record<string, { from: unknown; to: unknown }>
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'TASK',
    entityId: taskId,
    action: 'UPDATED',
    metadata: { projectId, changes },
  });
}

/**
 * Log task move (status change via Kanban)
 */
export async function logTaskMoved(
  actorId: string,
  taskId: string,
  projectId: string,
  fromStatus: string,
  toStatus: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'TASK',
    entityId: taskId,
    action: 'MOVED',
    metadata: { projectId, fromStatus, toStatus },
  });
}

/**
 * Log task deletion
 */
export async function logTaskDeleted(
  actorId: string,
  taskId: string,
  taskTitle: string,
  projectId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'TASK',
    entityId: taskId,
    action: 'DELETED',
    metadata: { taskTitle, projectId },
  });
}

/**
 * Log note creation
 */
export async function logNoteCreated(
  actorId: string,
  noteId: string,
  systemName: string,
  projectId?: string,
  clientId?: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'NOTE',
    entityId: noteId,
    action: 'CREATED',
    metadata: { systemName, projectId, clientId },
  });
}

/**
 * Log note update
 */
export async function logNoteUpdated(
  actorId: string,
  noteId: string,
  changes: Record<string, { from: unknown; to: unknown }>
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'NOTE',
    entityId: noteId,
    action: 'UPDATED',
    metadata: { changes },
  });
}

/**
 * Log note deletion
 */
export async function logNoteDeleted(
  actorId: string,
  noteId: string,
  systemName: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'NOTE',
    entityId: noteId,
    action: 'DELETED',
    metadata: { systemName },
  });
}

/**
 * Log file upload
 */
export async function logFileCreated(
  actorId: string,
  fileId: string,
  fileName: string,
  projectId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'FILE',
    entityId: fileId,
    action: 'CREATED',
    metadata: { fileName, projectId },
  });
}

/**
 * Log file deletion
 */
export async function logFileDeleted(
  actorId: string,
  fileId: string,
  fileName: string,
  projectId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'FILE',
    entityId: fileId,
    action: 'DELETED',
    metadata: { fileName, projectId },
  });
}

/**
 * Log comment creation
 */
export async function logCommentCreated(
  actorId: string,
  commentId: string,
  taskId: string,
  projectId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'COMMENT',
    entityId: commentId,
    action: 'CREATED',
    metadata: { taskId, projectId },
  });
}

/**
 * Log comment update
 */
export async function logCommentUpdated(
  actorId: string,
  commentId: string,
  taskId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'COMMENT',
    entityId: commentId,
    action: 'UPDATED',
    metadata: { taskId },
  });
}

/**
 * Log comment deletion
 */
export async function logCommentDeleted(
  actorId: string,
  commentId: string,
  taskId: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'COMMENT',
    entityId: commentId,
    action: 'DELETED',
    metadata: { taskId },
  });
}

/**
 * Log user creation
 */
export async function logUserCreated(
  actorId: string,
  userId: string,
  userName: string,
  userRole: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'USER',
    entityId: userId,
    action: 'CREATED',
    metadata: { userName, userRole },
  });
}

/**
 * Log user update
 */
export async function logUserUpdated(
  actorId: string,
  userId: string,
  changes: Record<string, { from: unknown; to: unknown }>
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'USER',
    entityId: userId,
    action: 'UPDATED',
    metadata: { changes },
  });
}

/**
 * Log user deletion/deactivation
 */
export async function logUserDeleted(
  actorId: string,
  userId: string,
  userName: string
): Promise<{ id: string }> {
  return logActivity({
    actorId,
    entityType: 'USER',
    entityId: userId,
    action: 'DELETED',
    metadata: { userName },
  });
}

// Re-export types for convenience
export type { EntityType, Action } from '@/lib/db/schema';
