/**
 * Project tasks list page
 * Requirements: 5.1, 5.2
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, Plus, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  TasksTable,
  TaskForm,
  TaskDetail,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/features/tasks';
import { useProject } from '@/features/projects';
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

export const Route = createFileRoute('/app/projects/$projectId/tasks')({
  component: ProjectTasksPage,
});



function ProjectTasksPage() {
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

  const project = projectData?.data;
  const tasks = tasksData?.data || [];

  // Get real users from database
  const { data: usersData } = useUsers();
  const users = usersData?.data?.map((u) => ({ id: u.id, name: u.name })) || [];

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
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
              {project?.name || 'Project'} - Tasks
            </h1>
            <p className="text-muted-foreground">
              View and manage project tasks in list view
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/projects/$projectId/board" params={{ projectId }}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Kanban View
            </Link>
          </Button>
          <Button onClick={() => setIsCreateFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      <TasksTable
        tasks={tasks}
        isLoading={isLoading}
        onTaskClick={handleTaskClick}
      />

      {/* Create Task Form */}
      <TaskForm
        open={isCreateFormOpen}
        onOpenChange={setIsCreateFormOpen}
        projectId={projectId}
        users={users}
        onSubmit={handleCreateSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Edit Task Form */}
      <TaskForm
        open={isEditFormOpen}
        onOpenChange={setIsEditFormOpen}
        task={selectedTask}
        projectId={projectId}
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
