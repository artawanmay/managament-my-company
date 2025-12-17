/**
 * Hook for viewing a note's secret
 * Requirements: 7.3, 7.5
 */
import { useMutation } from "@tanstack/react-query";
import { viewSecret } from "../api";
import { useSession } from "@/features/auth/hooks";

export function useViewSecret() {
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (noteId: string) => {
      return viewSecret(noteId, csrfToken || undefined);
    },
  });
}
