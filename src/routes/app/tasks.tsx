/**
 * Global tasks page
 * Requirements: 5.1, 5.2
 */
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  TasksTable,
  KanbanBoard,
  TaskForm,
  TaskDetail,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useViewMode,
  type Task,
  type TaskStatus,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/features/tasks';
import { useProjects } from '@/features/projects';
import { useUsers } from '@/features/users';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const Route = createFileRoute('/app/tasks')({
  component: TasksPage,
});



function TasksPage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { viewMode, setViewMode } = useViewMode();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const { data: tasksData, isLoading } = useTasks(
    selectedProjectId ? { projectId: selectedProjectId } : {}
  );
  const { data: projectsData } = useProjects();
  const { data: usersData } = useUsers();

  // Transform users data for the task form
  const users = usersData?.data?.map((u) => ({ id: u.id, name: u.name })) || [];
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const moveMutation = useMoveTask();

  const tasks = tasksData?.data || [];
  const projects = projectsData?.data || [];

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleCreateSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    if (!selectedProjectId) {
      toast({
        title: 'Error',
        description: 'Please select a project first',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        ...data,
        projectId: selectedProjectId,
      } as CreateTaskInput);
      toast({
        title: 'Task created',
        description: 'The task has been created successfully.',
      });
      setIsCreateFormOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleEditSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    if (!selectedTask) return;

    try {
      await updateMutation.mutateAsync({
        taskId: selectedTask.id,
        data: data as UpdateTaskInput,
        projectId: selectedTask.projectId,
      });
      toast({
        title: 'Task updated',
        description: 'The task has been updated successfully.',
      });
      setIsEditFormOpen(false);
      setSelectedTask(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleEditClick = () => {
    setIsDetailOpen(false);
    setIsEditFormOpen(true);
  };

  const handleDeleteClick = () => {
    if (selectedTask) {
      setTaskToDelete(selectedTask);
      setIsDetailOpen(false);
      setIsDeleteDialogOpen(true);
    }
  };

  const handleTaskMove = (taskId: string, newStatus: TaskStatus, newOrder: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Use mutate (fire-and-forget) instead of mutateAsync for smooth UI
    // Optimistic update in useMoveTask hook handles immediate UI feedback
    moveMutation.mutate(
      {
        taskId,
        data: { status: newStatus, order: newOrder },
        projectId: task.projectId,
      },
      {
        onError: (error) => {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to move task',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;

    try {
      await deleteMutation.mutateAsync({
        taskId: taskToDelete.id,
        projectId: taskToDelete.projectId,
      });
      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully.',
      });
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
      setSelectedTask(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">View and manage all your tasks</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedProjectId || "all"} onValueChange={(value) => setSelectedProjectId(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-md">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="rounded-r-none"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>List View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="rounded-l-none"
                  onClick={() => setViewMode('kanban')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Kanban View</TooltipContent>
            </Tooltip>
          </div>
          <Button
            onClick={() => setIsCreateFormOpen(true)}
            disabled={!selectedProjectId}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <TasksTable
          tasks={tasks}
          isLoading={isLoading}
          onTaskClick={handleTaskClick}
        />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onTaskMove={handleTaskMove}
          isLoading={isLoading}
        />
      )}

      {/* Create Task Form */}
      <TaskForm
        open={isCreateFormOpen}
        onOpenChange={setIsCreateFormOpen}
        projectId={selectedProjectId}
        users={users}
        onSubmit={handleCreateSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Edit Task Form */}
      <TaskForm
        open={isEditFormOpen}
        onOpenChange={setIsEditFormOpen}
        task={selectedTask}
        projectId={selectedTask?.projectId}
        users={users}
        onSubmit={handleEditSubmit}
        isLoading={updateMutation.isPending}
      />

      {/* Task Detail Modal */}
      <TaskDetail
        task={selectedTask}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskToDelete?.title}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
