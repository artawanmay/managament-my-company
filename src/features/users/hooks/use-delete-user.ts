/**
 * Hook for deleting a user
 * Requirements: 2.2, 2.3
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUser } from "../api";
import { useSession } from "@/features/auth/hooks";

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (userId: string) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return deleteUser(userId, csrfToken);
    },
    onSuccess: () => {
      // Invalidate users list to refetch
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
