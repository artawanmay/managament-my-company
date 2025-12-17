/**
 * Hook for fetching notes list
 * Requirements: 7.1
 */
import { useQuery } from "@tanstack/react-query";
import { fetchNotes, type NotesListParams } from "../api";

export const notesQueryKey = (params: NotesListParams = {}) =>
  ["notes", params] as const;

export function useNotes(params: NotesListParams = {}) {
  return useQuery({
    queryKey: notesQueryKey(params),
    queryFn: () => fetchNotes(params),
  });
}
