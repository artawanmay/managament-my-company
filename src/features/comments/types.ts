/**
 * Comments feature types
 */

export interface CommentUser {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  message: string;
  mentions: string[] | null;
  attachments: string[] | null;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: CommentUser | null;
}

export interface CreateCommentInput {
  message: string;
  attachments?: string[] | null;
}

export interface UpdateCommentInput {
  message: string;
}

export interface CommentsListResponse {
  data: Comment[];
}

export interface CommentResponse {
  data: Comment;
  notificationsCreated?: number;
}
