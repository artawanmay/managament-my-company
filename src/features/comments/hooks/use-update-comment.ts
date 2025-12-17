/**
 * Hook for updating a comment
 * Requirements: 8.4
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateComment } from "../api";
import { commentsQueryKey } from "./use-comments";
import { useSession } from "@/features/auth/hooks";
import type { UpdateCommentInput } from "../types";

export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({
      commentId,
      data,
    }: {
      commentId: string;
      data: UpdateCommentInput;
    }) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return updateComment(commentId, data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate comments list to refetch
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(taskId) });
    },
  });
}
