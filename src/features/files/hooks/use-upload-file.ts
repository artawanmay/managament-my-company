/**
 * Hook for uploading a file
 * Requirements: 13.1
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadFile } from "../api";
import { useSession } from "@/features/auth/hooks";

interface UploadFileParams {
  projectId: string;
  file: File;
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ projectId, file }: UploadFileParams) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return uploadFile(projectId, file, csrfToken);
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate files list to refetch
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
    },
  });
}
