/**
 * Client detail page
 * Requirements: 3.4, 3.5, 3.6
 */
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ClientDetail,
  ClientForm,
  useClient,
  useUpdateClient,
  useDeleteClient,
  useClientActivity,
} from "@/features/clients";
import { ActivityHistory } from "@/features/activity";

export const Route = createFileRoute("/app/clients/$clientId")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading, error } = useClient(clientId);
  const { data: activityData, isLoading: activityLoading } =
    useClientActivity(clientId);
  const updateMutation = useUpdateClient(clientId);
  const deleteMutation = useDeleteClient();

  const client = data?.data || null;

  const handleEdit = () => {
    setIsFormOpen(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = async (
    formData: Parameters<typeof updateMutation.mutateAsync>[0]
  ) => {
    try {
      await updateMutation.mutateAsync(formData);
      toast({
        title: "Client updated",
        description: "The client has been updated successfully.",
      });
      setIsFormOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteMutation.mutateAsync(clientId);
      toast({
        title: "Client deleted",
        description: "The client has been deleted successfully.",
      });
      navigate({ to: "/app/clients" });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">
          Error loading client: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ClientDetail
        client={client}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Activity History */}
      {client && (
        <ActivityHistory
          activities={activityData?.data || []}
          isLoading={activityLoading}
          title="Client History"
        />
      )}

      {client && (
        <ClientForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          client={client}
          onSubmit={handleFormSubmit}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{client?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
