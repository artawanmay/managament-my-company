/**
 * Hook for deleting a note
 * Requirements: 7.1
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteNote } from "../api";
import { useSession } from "@/features/auth/hooks";

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (noteId: string) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return deleteNote(noteId, csrfToken);
    },
    onSuccess: () => {
      // Invalidate notes list to refetch
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
