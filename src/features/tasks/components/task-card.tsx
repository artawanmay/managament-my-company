/**
 * TaskCard component for Kanban board
 * Draggable task card with priority, assignee, and due date info
 * Requirements: 27.4 - Touch-friendly with 44px minimum touch targets
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import type { Task } from '../types';
import { PRIORITY_CONFIG } from '../types';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  
  // Format due date
  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const dueDate = formatDueDate(task.dueDate);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        // Base styling with touch-friendly padding
        // Minimum 44px touch target area (Requirements 27.4)
        'p-3 min-h-[44px] cursor-grab active:cursor-grabbing glass-task-card',
        // Touch-friendly: larger tap area on mobile
        'touch-manipulation',
        isDragging && 'opacity-50 shadow-lg rotate-2',
        task.isOverdue && 'border-l-4 border-l-red-500'
      )}
    >
      {/* Title */}
      <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Meta info */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Priority badge */}
        <Badge variant="secondary" className={cn('text-xs', priorityConfig.color)}>
          {priorityConfig.label}
        </Badge>

        {/* Due date */}
        {dueDate && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs',
              task.isOverdue
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {task.isOverdue ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            <span>{dueDate}</span>
          </div>
        )}

        {/* Estimated hours */}
        {task.estimatedHours && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            <span>{task.estimatedHours}h</span>
          </div>
        )}
      </div>

      {/* Assignee */}
      {task.assignee && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Avatar className="h-5 w-5">
            <AvatarImage src={task.assignee.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">
              {task.assignee.name?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
            {task.assignee.name}
          </span>
        </div>
      )}
    </Card>
  );
}
