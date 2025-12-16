/**
 * KanbanBoard component
 * Main Kanban board with drag-and-drop functionality
 * Requirements: 6.1, 6.2, 6.3, 6.5, 17.3, 27.3, 27.4
 * 
 * Responsive behavior:
 * - Desktop (>=1200px): Horizontal layout with all columns visible
 * - Tablet (768px-1199px): Horizontal scroll for columns
 * - Mobile (<768px): Vertical stacking with horizontal scroll option
 */
import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './kanban-column';
import { TaskCard } from './task-card';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Rows3 } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { KANBAN_COLUMNS } from '../types';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, newStatus: TaskStatus, newOrder: number) => void;
  onTaskClick?: (task: Task) => void;
  isLoading?: boolean;
}

type ViewMode = 'horizontal' | 'vertical';

export function KanbanBoard({
  tasks,
  onTaskMove,
  onTaskClick,
  isLoading,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // Mobile view mode: vertical (stacked) or horizontal (scroll)
  const [mobileViewMode, setMobileViewMode] = useState<ViewMode>('vertical');

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      CHANGES_REQUESTED: [],
      DONE: [],
    };

    // Sort tasks by order within each status
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

    for (const task of sortedTasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }

    return grouped;
  }, [tasks]);

  // Configure sensors for drag detection with touch support for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Delay before drag starts on touch to allow scrolling
        tolerance: 5, // Movement tolerance during delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const task = tasks.find((t) => t.id === active.id);
      if (task) {
        setActiveTask(task);
      }
    },
    [tasks]
  );

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could be used for optimistic UI updates during drag
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine the target status
      let targetStatus: TaskStatus;
      let targetOrder: number;

      // Check if dropped on a column
      if (KANBAN_COLUMNS.some((col) => col.id === over.id)) {
        targetStatus = over.id as TaskStatus;
        // Place at the end of the column
        targetOrder = tasksByStatus[targetStatus].length;
      } else {
        // Dropped on another task - find its status and position
        const overTask = tasks.find((t) => t.id === over.id);
        if (!overTask) return;

        targetStatus = overTask.status;
        const tasksInColumn = tasksByStatus[targetStatus];
        const overIndex = tasksInColumn.findIndex((t) => t.id === over.id);
        targetOrder = overIndex >= 0 ? overIndex : tasksInColumn.length;
      }

      // Only trigger move if something changed
      if (task.status !== targetStatus || task.order !== targetOrder) {
        onTaskMove(taskId, targetStatus, targetOrder);
      }
    },
    [tasks, tasksByStatus, onTaskMove]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => (
          <Card
            key={column.id}
            className="min-w-full md:min-w-[280px] md:max-w-[320px] h-[200px] md:h-[400px] animate-pulse bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Mobile view mode toggle - only visible on mobile (<768px) */}
      <div className="flex items-center justify-end gap-2 mb-4 md:hidden">
        <span className="text-sm text-muted-foreground">View:</span>
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          <Button
            variant={mobileViewMode === 'vertical' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMobileViewMode('vertical')}
            aria-label="Vertical stacked view"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
          <Button
            variant={mobileViewMode === 'horizontal' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMobileViewMode('horizontal')}
            aria-label="Horizontal scroll view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        {/* 
          Responsive layout:
          - Mobile (<768px): Vertical stack (default) or horizontal scroll based on toggle
          - Tablet (768px-1199px): Horizontal scroll
          - Desktop (>=1200px): Horizontal layout with all columns visible
        */}
        <div
          className={cn(
            'pb-4 min-h-[300px] md:min-h-[500px]',
            // Mobile: vertical stack by default, horizontal if toggled
            mobileViewMode === 'vertical'
              ? 'flex flex-col gap-4 md:flex-row md:gap-4'
              : 'flex flex-row gap-4 overflow-x-auto',
            // Tablet and desktop: always horizontal
            'md:flex-row md:gap-4'
          )}
        >
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              color={column.color}
              tasks={tasksByStatus[column.id]}
              onTaskClick={onTaskClick}
              isMobileVertical={mobileViewMode === 'vertical'}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Drag overlay - shows the dragged item */}
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3 opacity-90">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
