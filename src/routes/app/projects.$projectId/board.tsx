/**
 * Project Kanban board page
 * Requirements: 6.1, 6.2
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  KanbanBoard,
  TaskForm,
  TaskDetail,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  type Task,
  type TaskStatus,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/features/tasks';
import { useProject } from '@/features/projects';
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

export const Route = createFileRoute('/app/projects/$projectId/board')({
  component: ProjectBoardPage,
});

// Temporary mock users until user management is implemented
const mockUsers = [
  { id: 'user-1', name: 'Admin User' },
  { id: 'user-2', name: 'Manager User' },
  { id: 'user-3', name: 'Member User' },
];

function ProjectBoardPage() {
  const { projectId } = Route.useParams();
  const { toast } = useToast();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const { data: projectData, isLoading: projectLoading } = useProject(projectId);
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ projectId });
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const moveMutation = useMoveTask();

  const project = projectData?.data;
  const tasks = tasksData?.data || [];

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleTaskMove = async (taskId: string, newStatus: TaskStatus, newOrder: number) => {
    try {
      await moveMutation.mutateAsync({
        taskId,
        data: { status: newStatus, order: newOrder },
        projectId,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to move task',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        projectId,
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
        projectId,
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

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;

    try {
      await deleteMutation.mutateAsync({
        taskId: taskToDelete.id,
        projectId,
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

  const isLoading = projectLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/projects/$projectId" params={{ projectId }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {project?.name || 'Project'} - Kanban Board
            </h1>
            <p className="text-muted-foreground">
              Drag and drop tasks to update their status
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <KanbanBoard
        tasks={tasks}
        onTaskClick={handleTaskClick}
        onTaskMove={handleTaskMove}
        isLoading={isLoading}
      />

      {/* Create Task Form */}
      <TaskForm
        open={isCreateFormOpen}
        onOpenChange={setIsCreateFormOpen}
        projectId={projectId}
        users={mockUsers}
        onSubmit={handleCreateSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Edit Task Form */}
      <TaskForm
        open={isEditFormOpen}
        onOpenChange={setIsEditFormOpen}
        task={selectedTask}
        projectId={projectId}
        users={mockUsers}
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
