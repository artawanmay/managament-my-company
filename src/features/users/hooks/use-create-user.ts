/**
 * Hook for creating a user
 * Requirements: 2.2, 2.3
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser } from "../api";
import type { CreateUserInput } from "../types";
import { useSession } from "@/features/auth/hooks";

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateUserInput) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return createUser(data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate users list to refetch
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
