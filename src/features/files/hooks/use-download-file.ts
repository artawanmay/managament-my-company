/**
 * Hook for downloading a file
 * Requirements: 13.3
 */
import { useMutation } from '@tanstack/react-query';
import { downloadFile } from '../api';
import { useSession } from '@/features/auth/hooks';

interface DownloadFileParams {
  fileId: string;
  fileName: string;
}

export function useDownloadFile() {
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ fileId, fileName }: DownloadFileParams) => {
      return downloadFile(fileId, fileName, csrfToken ?? undefined);
    },
  });
}
