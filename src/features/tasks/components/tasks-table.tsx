/**
 * TasksTable component
 * Displays tasks in a table format with filtering and sorting
 * Requirements: 5.1, 5.2, 3.1, 1.3
 */
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, Search, Calendar, AlertCircle } from "lucide-react";
import type { Task, TaskStatus, Priority } from "../types";
import {
  TASK_STATUS_VALUES,
  PRIORITY_VALUES,
  PRIORITY_CONFIG,
  KANBAN_COLUMNS,
} from "../types";
import { cn } from "@/lib/utils";
import { useRenderTrackerSafe } from "@/lib/dev-tools/use-render-tracker-safe";

interface TasksTableProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
}

export function TasksTable({ tasks, isLoading, onTaskClick }: TasksTableProps) {
  // Render tracking for performance monitoring (Requirements: 1.3)
  useRenderTrackerSafe("TasksTable", {
    maxRenderCount: 50,
    timeWindowMs: 1000,
  });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");

  // Memoize filtered tasks to prevent excessive re-renders (Requirements: 3.1)
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && task.priority !== priorityFilter)
        return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter]);

  // Memoize columns to maintain stable references (Requirements: 3.1)
  const columns: ColumnDef<Task>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="flex items-center gap-2">
              {task.isOverdue && (
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <span className="font-medium truncate max-w-[300px]">
                {task.title}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as TaskStatus;
          const column = KANBAN_COLUMNS.find((c) => c.id === status);
          return (
            <Badge variant="outline" className="whitespace-nowrap">
              {column?.title || status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const priority = row.getValue("priority") as Priority;
          const config = PRIORITY_CONFIG[priority];
          return (
            <Badge
              variant="secondary"
              className={cn("whitespace-nowrap", config.color)}
            >
              {config.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "assignee",
        header: "Assignee",
        cell: ({ row }) => {
          const task = row.original;
          if (!task.assignee) {
            return <span className="text-gray-400">Unassigned</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={task.assignee.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {task.assignee.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[120px]">
                {task.assignee.name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Due Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const task = row.original;
          if (!task.dueDate) return <span className="text-gray-400">-</span>;
          const date = new Date(task.dueDate);
          return (
            <div
              className={cn(
                "flex items-center gap-1",
                task.isOverdue && "text-red-600 dark:text-red-400"
              )}
            >
              <Calendar className="h-4 w-4" />
              <span>{date.toLocaleDateString()}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "projectName",
        header: "Project",
        cell: ({ row }) => {
          const projectName = row.getValue("projectName") as string | undefined;
          return (
            <span className="truncate max-w-[150px] text-gray-600 dark:text-gray-400">
              {projectName || "-"}
            </span>
          );
        },
      },
    ],
    []
  ); // Empty deps - columns definition is static

  const table = useReactTable({
    data: filteredTasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="border rounded-lg">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border-b last:border-b-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as TaskStatus | "ALL")
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {TASK_STATUS_VALUES.map((status) => {
              const column = KANBAN_COLUMNS.find((c) => c.id === status);
              return (
                <SelectItem key={status} value={status}>
                  {column?.title || status}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(value) =>
            setPriorityFilter(value as Priority | "ALL")
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            {PRIORITY_VALUES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_CONFIG[priority].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No tasks found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => onTaskClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {filteredTasks.length} of {tasks.length} tasks
      </div>
    </div>
  );
}
