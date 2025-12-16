/**
 * CommentThread component
 * List of comments on a task
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';
import { CommentItem } from './comment-item';
import { CommentForm } from './comment-form';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '../hooks';
import type { Comment } from '../types';

interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface CommentThreadProps {
  taskId: string;
  currentUserId: string;
  currentUserRole: string;
  projectMembers?: MentionUser[];
}

export function CommentThread({
  taskId,
  currentUserId,
  currentUserRole,
  projectMembers = [],
}: CommentThreadProps) {
  const { data, isLoading, error } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const isAdmin = currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN';
  const canComment = currentUserRole !== 'GUEST';

  const handleCreateComment = async (message: string) => {
    await createComment.mutateAsync({ message });
  };

  const handleUpdateComment = async (commentId: string, message: string) => {
    await updateComment.mutateAsync({ commentId, data: { message } });
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment.mutateAsync(commentId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-medium">Comments</h3>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Failed to load comments</p>
        <p className="text-sm text-gray-500">{error.message}</p>
      </div>
    );
  }

  const comments = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-medium">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {/* Comment form at top */}
      {canComment && (
        <>
          <CommentForm
            onSubmit={handleCreateComment}
            isSubmitting={createComment.isPending}
            projectMembers={projectMembers}
          />
          {comments.length > 0 && <Separator />}
        </>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No comments yet</p>
          {canComment && (
            <p className="text-sm">Be the first to comment on this task</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {comments.map((comment: Comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onUpdate={handleUpdateComment}
              onDelete={handleDeleteComment}
              isUpdating={updateComment.isPending}
              isDeleting={deleteComment.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
