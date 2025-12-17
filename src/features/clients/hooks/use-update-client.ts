/**
 * Hook for updating a client
 * Requirements: 3.5
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateClient } from "../api";
import type { UpdateClientInput } from "../types";
import { useSession } from "@/features/auth/hooks";
import { clientQueryKey } from "./use-client";

export function useUpdateClient(clientId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: UpdateClientInput) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return updateClient(clientId, data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate both the single client and the list
      queryClient.invalidateQueries({ queryKey: clientQueryKey(clientId) });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
