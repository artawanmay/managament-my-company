/**
 * KanbanColumn component
 * A single column in the Kanban board with droppable area
 * Requirements: 6.5, 17.3, 27.3, 27.4
 *
 * Responsive behavior:
 * - Mobile vertical: Full width, collapsible columns
 * - Mobile horizontal / Tablet / Desktop: Fixed width columns
 */
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "../types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  /** Whether the column is in mobile vertical stacked mode */
  isMobileVertical?: boolean;
}

export function KanbanColumn({
  id,
  title,
  color,
  tasks,
  onTaskClick,
  isMobileVertical = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // Collapsible state for mobile vertical view
  const [isCollapsed, setIsCollapsed] = useState(false);

  const taskIds = tasks.map((task) => task.id);

  return (
    <div
      className={cn(
        "flex flex-col glass-kanban-column",
        // Mobile vertical: full width
        // Mobile horizontal / Tablet / Desktop: fixed width
        isMobileVertical
          ? "w-full min-w-full"
          : "min-w-[280px] max-w-[320px] shrink-0",
        // Tablet: ensure proper sizing for horizontal scroll
        "md:min-w-[280px] md:max-w-[320px] md:shrink-0",
        color
      )}
    >
      {/* Column header - touch-friendly with 44px min height */}
      <button
        type="button"
        onClick={() => isMobileVertical && setIsCollapsed(!isCollapsed)}
        className={cn(
          "flex items-center justify-between p-3 border-b border-[var(--glass-border)]",
          // Ensure 44px minimum touch target on mobile (Requirements 27.4)
          "min-h-[44px]",
          // Only make clickable on mobile vertical view
          isMobileVertical &&
            "cursor-pointer hover:bg-white/10 dark:hover:bg-black/10 transition-colors",
          !isMobileVertical && "cursor-default"
        )}
        aria-expanded={!isCollapsed}
        aria-controls={`column-${id}-content`}
      >
        <div className="flex items-center gap-2">
          {/* Collapse indicator - only on mobile vertical */}
          {isMobileVertical && (
            <span className="text-gray-500 dark:text-gray-400 md:hidden">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          )}
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
            {title}
          </h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-700/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
          {tasks.length}
        </span>
      </button>

      {/* Droppable area - collapsible on mobile vertical */}
      <div
        id={`column-${id}-content`}
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 transition-all duration-200",
          // Minimum height for drop target
          "min-h-[100px] md:min-h-[200px]",
          isOver && "bg-blue-50/50 dark:bg-blue-900/30",
          // Collapse on mobile vertical view
          isMobileVertical && isCollapsed && "hidden md:block"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-400 dark:text-gray-500 border-2 border-dashed border-[var(--glass-border)] rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
