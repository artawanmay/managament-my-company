/**
 * ActivityHistory component
 * Displays activity logs in a timeline format
 */
import { formatDistanceToNow } from 'date-fns';
import { User, FileText, FolderKanban, CheckSquare, MessageSquare, File } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActivityLog {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
}

interface ActivityHistoryProps {
  activities: ActivityLog[];
  isLoading?: boolean;
  title?: string;
}

const entityIcons: Record<string, React.ElementType> = {
  CLIENT: User,
  PROJECT: FolderKanban,
  TASK: CheckSquare,
  NOTE: FileText,
  COMMENT: MessageSquare,
  FILE: File,
  USER: User,
};

const actionLabels: Record<string, string> = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  MOVED: 'moved',
  ARCHIVED: 'archived',
};

function getActivityDescription(activity: ActivityLog): string {
  const action = actionLabels[activity.action] || activity.action.toLowerCase();
  const entityType = activity.entityType.toLowerCase();
  const metadata = activity.metadata;

  // Build description based on entity type and action
  if (activity.entityType === 'CLIENT') {
    if (activity.action === 'CREATED') {
      return `Created client "${metadata?.clientName || 'Unknown'}"`;
    }
    if (activity.action === 'UPDATED') {
      const changes = metadata?.changes as Record<string, { from: unknown; to: unknown }> | undefined;
      if (changes) {
        const changeList = Object.keys(changes).join(', ');
        return `Updated client (${changeList})`;
      }
      return 'Updated client';
    }
    if (activity.action === 'DELETED') {
      return `Deleted client "${metadata?.clientName || 'Unknown'}"`;
    }
  }

  if (activity.entityType === 'PROJECT') {
    if (activity.action === 'CREATED') {
      return `Created project "${metadata?.projectName || 'Unknown'}"`;
    }
    if (activity.action === 'UPDATED') {
      const changes = metadata?.changes as Record<string, { from: unknown; to: unknown }> | undefined;
      if (changes) {
        const changeList = Object.keys(changes).join(', ');
        return `Updated project (${changeList})`;
      }
      return 'Updated project';
    }
    if (activity.action === 'ARCHIVED') {
      return `Archived project "${metadata?.projectName || 'Unknown'}"`;
    }
  }

  if (activity.entityType === 'TASK') {
    if (activity.action === 'CREATED') {
      return `Created task "${metadata?.taskTitle || 'Unknown'}"`;
    }
    if (activity.action === 'MOVED') {
      return `Moved task from "${metadata?.fromStatus}" to "${metadata?.toStatus}"`;
    }
    if (activity.action === 'UPDATED') {
      return 'Updated task';
    }
    if (activity.action === 'DELETED') {
      return `Deleted task "${metadata?.taskTitle || 'Unknown'}"`;
    }
  }

  if (activity.entityType === 'FILE') {
    if (activity.action === 'CREATED') {
      return `Uploaded file "${metadata?.fileName || 'Unknown'}"`;
    }
    if (activity.action === 'DELETED') {
      return `Deleted file "${metadata?.fileName || 'Unknown'}"`;
    }
  }

  if (activity.entityType === 'NOTE') {
    if (activity.action === 'CREATED') {
      return `Created note "${metadata?.systemName || 'Unknown'}"`;
    }
    if (activity.action === 'UPDATED') {
      return 'Updated note';
    }
    if (activity.action === 'DELETED') {
      return `Deleted note "${metadata?.systemName || 'Unknown'}"`;
    }
  }

  if (activity.entityType === 'COMMENT') {
    return `${action} a comment`;
  }

  return `${action} ${entityType}`;
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

export function ActivityHistory({ activities, isLoading, title = 'Activity History' }: ActivityHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">No activity yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = entityIcons[activity.entityType] || FileText;
            return (
              <div key={activity.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={activity.actorAvatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(activity.actorName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm">
                      <span className="font-medium">{activity.actorName || 'Unknown'}</span>{' '}
                      <span className="text-muted-foreground">
                        {getActivityDescription(activity)}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
