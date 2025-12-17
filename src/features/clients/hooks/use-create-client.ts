/**
 * Hook for creating a client
 * Requirements: 3.1
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../api";
import type { CreateClientInput } from "../types";
import { useSession } from "@/features/auth/hooks";

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateClientInput) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return createClient(data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate clients list to refetch
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
