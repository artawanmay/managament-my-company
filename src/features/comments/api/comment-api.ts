/**
 * Comments API functions
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
import type {
  Comment,
  CommentsListResponse,
  CommentResponse,
  CreateCommentInput,
  UpdateCommentInput,
} from '../types';

/**
 * Fetch comments for a task
 */
export async function fetchComments(
  taskId: string,
  csrfToken?: string
): Promise<CommentsListResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`/api/tasks/${taskId}/comments`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch comments' }));
    throw new Error(error.error || 'Failed to fetch comments');
  }

  return response.json();
}

/**
 * Create a new comment on a task
 * Requirements: 8.1, 8.2, 8.3
 */
export async function createComment(
  taskId: string,
  data: CreateCommentInput,
  csrfToken: string
): Promise<CommentResponse> {
  const response = await fetch(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create comment' }));
    throw new Error(error.error || 'Failed to create comment');
  }

  return response.json();
}

/**
 * Update a comment
 * Requirements: 8.4
 */
export async function updateComment(
  commentId: string,
  data: UpdateCommentInput,
  csrfToken: string
): Promise<{ data: Comment }> {
  const response = await fetch(`/api/comments/${commentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update comment' }));
    throw new Error(error.error || 'Failed to update comment');
  }

  return response.json();
}

/**
 * Delete a comment
 * Requirements: 8.5
 */
export async function deleteComment(
  commentId: string,
  csrfToken: string
): Promise<{ success: boolean }> {
  const response = await fetch(`/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete comment' }));
    throw new Error(error.error || 'Failed to delete comment');
  }

  return response.json();
}
