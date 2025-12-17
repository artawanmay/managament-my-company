/**
 * Clients list page
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ClientsTable,
  ClientForm,
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  type Client,
  type CreateClientInput,
  type UpdateClientInput,
} from "@/features/clients";

export const Route = createFileRoute("/app/clients/")({
  component: ClientsPage,
});

function ClientsPage() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const { data, isLoading, error } = useClients();
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient(editingClient?.id || "");
  const deleteMutation = useDeleteClient();

  const handleCreate = () => {
    setEditingClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleDelete = (client: Client) => {
    setDeleteClient(client);
  };

  const handleFormSubmit = async (
    formData: CreateClientInput | UpdateClientInput
  ) => {
    try {
      if (editingClient) {
        await updateMutation.mutateAsync(formData as UpdateClientInput);
        toast({
          title: "Client updated",
          description: "The client has been updated successfully.",
        });
      } else {
        await createMutation.mutateAsync(formData as CreateClientInput);
        toast({
          title: "Client created",
          description: "The client has been created successfully.",
        });
      }
      setIsFormOpen(false);
      setEditingClient(null);
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
    if (!deleteClient) return;

    try {
      await deleteMutation.mutateAsync(deleteClient.id);
      toast({
        title: "Client deleted",
        description: "The client has been deleted successfully.",
      });
      setDeleteClient(null);
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
          Error loading clients: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client relationships
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      <ClientsTable
        data={data?.data || []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ClientForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteClient?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClient(null)}>
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
