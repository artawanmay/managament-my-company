/**
 * Users Management Page
 * Requirements: 2.2, 2.3
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/features/auth/hooks';
import {
  UsersTable,
  CreateUserForm,
  EditUserForm,
  RoleChangeDialog,
  DeleteUserDialog,
} from '@/features/users/components';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useUpdateUserRole,
  useDeleteUser,
} from '@/features/users/hooks';
import type { User, Role, CreateUserInput, UpdateUserInput } from '@/features/users/types';

export const Route = createFileRoute('/app/users')({
  component: UsersPage,
});

function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: isSessionLoading } = useSession();
  const { data, isLoading, error } = useUsers();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Mutations
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const updateUserRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  // Check if current user can manage users
  const canManageUsers =
    currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  const handleCreateUser = async (data: CreateUserInput) => {
    try {
      await createUser.mutateAsync(data);
      toast({
        title: 'User created',
        description: 'The user has been created successfully.',
      });
      setCreateDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleEditUser = async (data: UpdateUserInput) => {
    if (!selectedUser) return;

    try {
      await updateUser.mutateAsync({ userId: selectedUser.id, data });
      toast({
        title: 'User updated',
        description: 'The user has been updated successfully.',
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  const handleChangeRole = async (userId: string, newRole: Role) => {
    try {
      await updateUserRole.mutateAsync({ userId, data: { role: newRole } });
      toast({
        title: 'Role changed',
        description: 'The user role has been changed successfully.',
      });
      setRoleDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change user role',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser.mutateAsync(userId);
      toast({
        title: 'User deleted',
        description: 'The user has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Show loading skeleton while session is being fetched to prevent "Access Denied" flash
  if (isSessionLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to manage users. Only administrators can access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to load users'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage all user accounts in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <UsersTable
              data={data?.data || []}
              currentUserId={currentUser?.id}
              currentUserRole={currentUser?.role as Role}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onChangeRole={openRoleDialog}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        currentUserRole={currentUser?.role as Role}
        onSubmit={handleCreateUser}
        isLoading={createUser.isPending}
      />

      {/* Edit User Dialog */}
      {selectedUser && (
        <EditUserForm
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSubmit={handleEditUser}
          isLoading={updateUser.isPending}
        />
      )}

      {/* Role Change Dialog */}
      <RoleChangeDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        user={selectedUser}
        currentUserRole={currentUser?.role as Role}
        onConfirm={handleChangeRole}
        isLoading={updateUserRole.isPending}
      />

      {/* Delete User Dialog */}
      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={selectedUser}
        onConfirm={handleDeleteUser}
        isLoading={deleteUser.isPending}
      />
    </div>
  );
}
