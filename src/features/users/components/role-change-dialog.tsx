/**
 * RoleChangeDialog component for changing user roles
 * Requirements: 2.2, 2.3
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User, Role } from "../types";
import { roleValues } from "@/lib/db/schema/users";

interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  currentUserRole?: Role;
  onConfirm: (userId: string, newRole: Role) => void;
  isLoading?: boolean;
}

export function RoleChangeDialog({
  open,
  onOpenChange,
  user,
  currentUserRole,
  onConfirm,
  isLoading,
}: RoleChangeDialogProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get available roles based on current user's role
  // Only SUPER_ADMIN can manage users (ADMIN role removed)
  const availableRoles = roleValues.filter(() => {
    if (currentUserRole === "SUPER_ADMIN") return true;
    return false;
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedRole(null);
      setShowConfirmation(false);
    }
    onOpenChange(newOpen);
  };

  const handleRoleChange = () => {
    if (selectedRole && selectedRole !== user?.role) {
      setShowConfirmation(true);
    }
  };

  const handleConfirm = () => {
    if (user && selectedRole) {
      onConfirm(user.id, selectedRole);
      setShowConfirmation(false);
      handleOpenChange(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {user.name}. This will affect their
              permissions in the system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Current role:{" "}
                <span className="font-medium">
                  {user.role.replace("_", " ")}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New Role</label>
              <Select
                value={selectedRole || user.role}
                onValueChange={(value) => setSelectedRole(value as Role)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={
                isLoading || !selectedRole || selectedRole === user.role
              }
            >
              Change Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change {user.name}&apos;s role from{" "}
              <span className="font-medium">{user.role.replace("_", " ")}</span>{" "}
              to{" "}
              <span className="font-medium">
                {selectedRole?.replace("_", " ")}
              </span>
              ? This action will immediately affect their permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Changing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
