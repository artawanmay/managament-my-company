/**
 * Hook for updating a note
 * Requirements: 7.1
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateNote } from "../api";
import type { UpdateNoteInput } from "../types";
import { useSession } from "@/features/auth/hooks";

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({
      noteId,
      data,
    }: {
      noteId: string;
      data: UpdateNoteInput;
    }) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return updateNote(noteId, data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate notes list and specific note
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["notes", variables.noteId] });
    },
  });
}
