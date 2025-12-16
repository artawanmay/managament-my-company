/**
 * ActivityItem component - displays a single activity log entry
 */
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Archive,
  User,
  Building2,
  FolderKanban,
  CheckSquare,
  FileText,
  File,
  MessageSquare,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ActivityLog, EntityType, Action } from '../types';

interface ActivityItemProps {
  activity: ActivityLog;
}

const entityIcons: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  CLIENT: Building2,
  PROJECT: FolderKanban,
  TASK: CheckSquare,
  NOTE: FileText,
  FILE: File,
  COMMENT: MessageSquare,
  USER: User,
};

const actionIcons: Record<Action, React.ComponentType<{ className?: string }>> = {
  CREATED: Plus,
  UPDATED: Pencil,
  DELETED: Trash2,
  MOVED: ArrowRight,
  ARCHIVED: Archive,
};

const actionColors: Record<Action, string> = {
  CREATED: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  UPDATED: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  DELETED: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  MOVED: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  ARCHIVED: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
};

function getActivityDescription(activity: ActivityLog): string {
  const { entityType, action, metadata } = activity;
  const entityName = entityType.toLowerCase();

  switch (action) {
    case 'CREATED':
      if (metadata?.taskTitle) return `created task "${metadata.taskTitle}"`;
      if (metadata?.projectName) return `created project "${metadata.projectName}"`;
      if (metadata?.clientName) return `created client "${metadata.clientName}"`;
      if (metadata?.systemName) return `created note "${metadata.systemName}"`;
      if (metadata?.fileName) return `uploaded file "${metadata.fileName}"`;
      if (metadata?.userName) return `created user "${metadata.userName}"`;
      return `created a ${entityName}`;

    case 'UPDATED':
      if (metadata?.changes) {
        const changedFields = Object.keys(metadata.changes);
        if (changedFields.length === 1) {
          return `updated ${changedFields[0]} of a ${entityName}`;
        }
        return `updated ${changedFields.length} fields of a ${entityName}`;
      }
      return `updated a ${entityName}`;

    case 'DELETED':
      if (metadata?.taskTitle) return `deleted task "${metadata.taskTitle}"`;
      if (metadata?.projectName) return `deleted project "${metadata.projectName}"`;
      if (metadata?.clientName) return `deleted client "${metadata.clientName}"`;
      if (metadata?.systemName) return `deleted note "${metadata.systemName}"`;
      if (metadata?.fileName) return `deleted file "${metadata.fileName}"`;
      if (metadata?.userName) return `deleted user "${metadata.userName}"`;
      return `deleted a ${entityName}`;

    case 'MOVED':
      if (metadata?.fromStatus && metadata?.toStatus) {
        return `moved task from ${metadata.fromStatus} to ${metadata.toStatus}`;
      }
      return `moved a ${entityName}`;

    case 'ARCHIVED':
      if (metadata?.projectName) return `archived project "${metadata.projectName}"`;
      return `archived a ${entityName}`;

    default:
      return `performed action on a ${entityName}`;
  }
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const EntityIcon = entityIcons[activity.entityType];
  const ActionIcon = actionIcons[activity.action];
  const actionColor = actionColors[activity.action];

  const description = getActivityDescription(activity);
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Actor Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={activity.actorAvatarUrl || undefined} alt={activity.actorName || 'User'} />
        <AvatarFallback className="text-xs">{getInitials(activity.actorName)}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{activity.actorName || 'Unknown user'}</span>
          <span className="text-muted-foreground text-sm">{description}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {/* Action Badge */}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${actionColor}`}>
            <ActionIcon className="h-3 w-3" />
            {activity.action}
          </span>
          {/* Entity Badge */}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <EntityIcon className="h-3 w-3" />
            {activity.entityType}
          </span>
          {/* Time */}
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}
