/**
 * Global tasks page
 * Requirements: 5.1, 5.2
 */
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { useProjects } from '@/features/projects';
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

export const Route = createFileRoute('/app/tasks')({
  component: TasksPage,
});

// Temporary mock users until user management is implemented
const mockUsers = [
  { id: 'user-1', name: 'Admin User' },
  { id: 'user-2', name: 'Manager User' },
  { id: 'user-3', name: 'Member User' },
];

function TasksPage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
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
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

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
          <Button
            onClick={() => setIsCreateFormOpen(true)}
            disabled={!selectedProjectId}
          >
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
        projectId={selectedProjectId}
        users={mockUsers}
        onSubmit={handleCreateSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Edit Task Form */}
      <TaskForm
        open={isEditFormOpen}
        onOpenChange={setIsEditFormOpen}
        task={selectedTask}
        projectId={selectedTask?.projectId}
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
