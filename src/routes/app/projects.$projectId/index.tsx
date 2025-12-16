/**
 * Project detail page (overview)
 * Requirements: 4.3, 4.4, 4.5
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ProjectDetail,
  ProjectForm,
  useProject,
  useUpdateProject,
  useAddProjectMember,
  useRemoveProjectMember,
  type ProjectMemberRole,
  type UpdateProjectInput,
} from '@/features/projects';
import { useClients } from '@/features/clients';

export const Route = createFileRoute('/app/projects/$projectId/')({
  component: ProjectDetailPage,
});

// Temporary mock users until user management is implemented
const mockUsers = [
  { id: 'user-1', name: 'Admin User', email: 'admin@test.com' },
  { id: 'user-2', name: 'Manager User', email: 'manager@test.com' },
  { id: 'user-3', name: 'Member User', email: 'member@test.com' },
];

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { toast } = useToast();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

  const { data, isLoading, error } = useProject(projectId);
  const { data: clientsData } = useClients();
  const updateMutation = useUpdateProject(projectId);
  const addMemberMutation = useAddProjectMember(projectId);
  const removeMemberMutation = useRemoveProjectMember(projectId);

  const handleEditSubmit = async (formData: UpdateProjectInput) => {
    try {
      await updateMutation.mutateAsync(formData);
      toast({
        title: 'Project updated',
        description: 'The project has been updated successfully.',
      });
      setIsEditFormOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleAddMember = async (userId: string, role: ProjectMemberRole) => {
    try {
      await addMemberMutation.mutateAsync({ userId, role });
      toast({
        title: 'Member added',
        description: 'The member has been added to the project.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMemberMutation.mutateAsync(userId);
      toast({
        title: 'Member removed',
        description: 'The member has been removed from the project.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error loading project: {error.message}</p>
      </div>
    );
  }

  const project = data?.data || null;
  const clients = clientsData?.data?.map((c) => ({ id: c.id, name: c.name })) || [];

  // Convert project to ProjectListItem format for the form
  const projectForForm = project
    ? {
        id: project.id,
        clientId: project.clientId,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        managerId: project.managerId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        clientName: project.clientName,
        managerName: project.managerName,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Project Details</h1>
          </div>
        </div>
        {project?.canManage && (
          <Button onClick={() => setIsEditFormOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Project
          </Button>
        )}
      </div>

      <ProjectDetail
        project={project}
        availableUsers={mockUsers}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        isLoading={isLoading}
      />

      {projectForForm && (
        <ProjectForm
          open={isEditFormOpen}
          onOpenChange={setIsEditFormOpen}
          project={projectForForm}
          clients={clients}
          users={mockUsers}
          onSubmit={handleEditSubmit}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
