/**
 * CommentItem component
 * Single comment with edit/delete actions
 * Requirements: 8.4, 8.5
 */
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Comment } from "../types";

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  isAdmin: boolean;
  onUpdate: (commentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(comment.message);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isAuthor = comment.userId === currentUserId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const handleSaveEdit = async () => {
    if (!editMessage.trim()) return;
    await onUpdate(comment.id, editMessage.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditMessage(comment.message);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(comment.id);
    setShowDeleteDialog(false);
  };

  // Parse message to highlight @mentions
  const renderMessage = (message: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = message.split(mentionRegex);

    return parts.map((part, index) => {
      // Every odd index is a mention (captured group)
      if (index % 2 === 1) {
        return (
          <span
            key={index}
            className="text-blue-600 dark:text-blue-400 font-medium"
          >
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex gap-3 py-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.user?.avatarUrl || undefined} />
        <AvatarFallback>
          {comment.user?.name?.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {comment.user?.name || "Unknown User"}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              (edited)
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              className="min-h-[80px] text-sm"
              placeholder="Edit your comment..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isUpdating || !editMessage.trim()}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
            {renderMessage(comment.message)}
          </p>
        )}
      </div>

      {(canEdit || canDelete) && !isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Comment actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
