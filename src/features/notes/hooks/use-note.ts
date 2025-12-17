/**
 * Hook for fetching a single note
 * Requirements: 7.1
 */
import { useQuery } from "@tanstack/react-query";
import { fetchNote } from "../api";

export const noteQueryKey = (noteId: string) => ["notes", noteId] as const;

export function useNote(noteId: string, enabled = true) {
  return useQuery({
    queryKey: noteQueryKey(noteId),
    queryFn: () => fetchNote(noteId),
    enabled: enabled && !!noteId,
  });
}
