/**
 * useCreateProject mutation hook
 * Requirements: 4.1
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject } from '../api';
import { projectsQueryKey } from './use-projects';
import { useSession } from '@/features/auth/hooks';
import type { CreateProjectInput } from '../types';

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => {
      if (!csrfToken) {
        throw new Error('No CSRF token available');
      }
      return createProject(data, csrfToken);
    },
    onSuccess: () => {
      // Invalidate projects list to refetch
      queryClient.invalidateQueries({ queryKey: projectsQueryKey() });
    },
  });
}
