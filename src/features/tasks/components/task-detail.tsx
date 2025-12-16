/**
 * TaskDetail component
 * Modal/dialog showing full task information
 * Requirements: 6.6
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  AlertCircle,
  User,
  Folder,
  Edit,
  Trash2,
} from 'lucide-react';
import type { Task } from '../types';
import { PRIORITY_CONFIG, KANBAN_COLUMNS } from '../types';
import { cn } from '@/lib/utils';

interface TaskDetailProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskDetail({
  task,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: TaskDetailProps) {
  if (!task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const statusColumn = KANBAN_COLUMNS.find((c) => c.id === task.status);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                {task.isOverdue && (
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                )}
                {task.title}
              </DialogTitle>
              {task.projectName && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Folder className="h-4 w-4" />
                  {task.projectName}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status and Priority */}
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="text-sm">
              {statusColumn?.title || task.status}
            </Badge>
            <Badge variant="secondary" className={cn('text-sm', priorityConfig.color)}>
              {priorityConfig.label} Priority
            </Badge>
            {task.isOverdue && (
              <Badge variant="destructive" className="text-sm">
                Overdue
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </h4>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <User className="h-4 w-4" />
                Assignee
              </h4>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={task.assignee.avatarUrl || undefined} />
                    <AvatarFallback>
                      {task.assignee.name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{task.assignee.name}</p>
                    <p className="text-xs text-gray-500">{task.assignee.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Unassigned</p>
              )}
            </div>

            {/* Reporter */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <User className="h-4 w-4" />
                Reporter
              </h4>
              {task.reporter ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={task.reporter.avatarUrl || undefined} />
                    <AvatarFallback>
                      {task.reporter.name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{task.reporter.name}</p>
                    <p className="text-xs text-gray-500">{task.reporter.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Unknown</p>
              )}
            </div>

            {/* Due Date */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Due Date
              </h4>
              {task.dueDate ? (
                <p
                  className={cn(
                    'text-sm',
                    task.isOverdue && 'text-red-600 dark:text-red-400 font-medium'
                  )}
                >
                  {formatDate(task.dueDate)}
                </p>
              ) : (
                <p className="text-gray-400">No due date</p>
              )}
            </div>

            {/* Time Tracking */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Time Tracking
              </h4>
              <div className="text-sm">
                {task.estimatedHours ? (
                  <p>
                    Estimated: <span className="font-medium">{task.estimatedHours}h</span>
                  </p>
                ) : null}
                {task.actualHours ? (
                  <p>
                    Actual: <span className="font-medium">{task.actualHours}h</span>
                  </p>
                ) : null}
                {!task.estimatedHours && !task.actualHours && (
                  <p className="text-gray-400">No time tracked</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>Created: {formatDateTime(task.createdAt)}</p>
            <p>Updated: {formatDateTime(task.updatedAt)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
