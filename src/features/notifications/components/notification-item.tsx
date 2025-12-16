/**
 * NotificationItem component
 * Displays a single notification with navigation support
 * Requirements: 9.3, 9.4
 */
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  MessageSquare,
  AtSign,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '../types';
import { useMarkAsRead } from '../hooks';

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: () => void;
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'TASK_ASSIGNED':
      return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    case 'TASK_MOVED':
      return <ArrowRight className="h-4 w-4 text-green-500" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="h-4 w-4 text-purple-500" />;
    case 'MENTIONED':
      return <AtSign className="h-4 w-4 text-orange-500" />;
    case 'DEADLINE_APPROACHING':
      return <Clock className="h-4 w-4 text-red-500" />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
  }
}

/**
 * Get navigation path from notification data
 */
function getNavigationPath(notification: Notification): string | null {
  const data = notification.data;
  if (!data) return null;

  // Navigate to task if available
  if (data.taskId && data.projectId) {
    return `/app/projects/${data.projectId}/tasks?taskId=${data.taskId}`;
  }

  // Navigate to project if available
  if (data.projectId) {
    return `/app/projects/${data.projectId}`;
  }

  return null;
}

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();
  const isUnread = !notification.readAt;

  const handleClick = async () => {
    // Mark as read if unread
    if (isUnread) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to related entity
    const path = getNavigationPath(notification);
    if (path) {
      navigate({ to: path });
      onNavigate?.();
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full flex-col items-start gap-1 p-3 text-left transition-colors hover:bg-accent',
        isUnread && 'bg-accent/50'
      )}
    >
      <div className="flex w-full items-start gap-2">
        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm', isUnread && 'font-medium')}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
        </div>
        {isUnread && (
          <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
        )}
      </div>
    </button>
  );
}
