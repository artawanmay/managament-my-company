/**
 * Hook for deleting a file
 * Requirements: 13.4
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFile } from "../api";
import { useSession } from "@/features/auth/hooks";

interface DeleteFileParams {
  fileId: string;
  projectId: string;
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ fileId }: DeleteFileParams) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return deleteFile(fileId, csrfToken);
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate files list to refetch
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
    },
  });
}
