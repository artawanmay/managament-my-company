/**
 * ProjectMembers component for managing project members
 * Requirements: 4.4, 4.5
 */
import { useState } from 'react';
import { UserPlus, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { projectMemberRoleValues } from '@/lib/db/schema';
import type { ProjectMemberWithUser, ProjectMemberRole } from '../types';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ProjectMembersProps {
  members: ProjectMemberWithUser[];
  availableUsers: UserOption[];
  canManage: boolean;
  onAddMember: (userId: string, role: ProjectMemberRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  isLoading?: boolean;
}

const roleColors: Record<ProjectMemberRole, string> = {
  MANAGER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  MEMBER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProjectMembers({
  members,
  availableUsers,
  canManage,
  onAddMember,
  onRemoveMember,
  isLoading,
}: ProjectMembersProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>('MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out users who are already members
  const memberUserIds = new Set(members.map((m) => m.userId));
  const filteredUsers = availableUsers.filter((u) => !memberUserIds.has(u.id));

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      await onAddMember(selectedUserId, selectedRole);
      setAddDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('MEMBER');
    } catch (error) {
      console.error('Failed to add member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member from the project?')) {
      return;
    }

    try {
      await onRemoveMember(userId);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Project Members</h3>
        {canManage && filteredUsers.length > 0 && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-4">Loading members...</div>
      ) : members.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <User className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2">No members assigned to this project</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.userAvatarUrl || undefined} />
                  <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.userName || 'Unknown User'}</p>
                  <p className="text-sm text-muted-foreground">{member.userEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={roleColors[member.role]} variant="outline">
                  {member.role}
                </Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.userId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Project Member</DialogTitle>
            <DialogDescription>
              Select a user and their role in this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as ProjectMemberRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {projectMemberRoleValues.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId || isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
