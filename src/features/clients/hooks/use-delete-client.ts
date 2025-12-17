/**
 * Hook for deleting a client
 * Requirements: 3.6
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteClient } from "../api";
import { useSession } from "@/features/auth/hooks";

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (clientId: string) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return deleteClient(clientId, csrfToken);
    },
    onSuccess: () => {
      // Invalidate clients list to refetch
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
