/**
 * Projects list page
 * Requirements: 4.1, 4.2, 4.6
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ProjectsTable,
  ProjectForm,
  useProjects,
  useCreateProject,
  useUpdateProject,
  useArchiveProject,
  type ProjectListItem,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@/features/projects';
import { useClients } from '@/features/clients';
import { useUsers } from '@/features/users';

export const Route = createFileRoute('/app/projects')({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [archiveProject, setArchiveProject] = useState<ProjectListItem | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data, isLoading, error } = useProjects({ includeArchived });
  const { data: clientsData } = useClients();
  const { data: usersData } = useUsers();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject(editingProject?.id || '');
  const archiveMutation = useArchiveProject(archiveProject?.id || '');

  const handleCreate = () => {
    setEditingProject(null);
    setIsFormOpen(true);
  };

  const handleEdit = (project: ProjectListItem) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleArchive = (project: ProjectListItem) => {
    setArchiveProject(project);
  };

  const handleFormSubmit = async (formData: CreateProjectInput | UpdateProjectInput) => {
    try {
      if (editingProject) {
        await updateMutation.mutateAsync(formData as UpdateProjectInput);
        toast({
          title: 'Project updated',
          description: 'The project has been updated successfully.',
        });
      } else {
        await createMutation.mutateAsync(formData as CreateProjectInput);
        toast({
          title: 'Project created',
          description: 'The project has been created successfully.',
        });
      }
      setIsFormOpen(false);
      setEditingProject(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveProject) return;

    try {
      await archiveMutation.mutateAsync();
      toast({
        title: 'Project archived',
        description: 'The project has been archived successfully.',
      });
      setArchiveProject(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error loading projects: {error.message}</p>
      </div>
    );
  }

  const clients = clientsData?.data?.map((c) => ({ id: c.id, name: c.name })) || [];
  const users = usersData?.data?.map((u) => ({ id: u.id, name: u.name, email: u.email })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your projects and track progress</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="includeArchived"
          checked={includeArchived}
          onCheckedChange={(checked) => setIncludeArchived(checked === true)}
        />
        <Label htmlFor="includeArchived" className="text-sm text-muted-foreground">
          Show archived projects
        </Label>
      </div>

      <ProjectsTable
        data={data?.data || []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onArchive={handleArchive}
      />

      <ProjectForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        project={editingProject}
        clients={clients}
        users={users}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Archive Confirmation Dialog */}
      <Dialog open={!!archiveProject} onOpenChange={() => setArchiveProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveProject?.name}"? Archived projects will be
              hidden from the default view but can still be accessed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveProject(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmArchive}
              disabled={archiveMutation.isPending}
            >
              <Archive className="mr-2 h-4 w-4" />
              {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
