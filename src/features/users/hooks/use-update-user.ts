/**
 * Hook for updating a user
 * Requirements: 2.2, 2.3
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUser } from "../api";
import type { UpdateUserInput } from "../types";
import { useSession } from "@/features/auth/hooks";

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateUserInput;
    }) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return updateUser(userId, data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate users list and specific user
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}
