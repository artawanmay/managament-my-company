/**
 * Project member mutation hooks
 * Requirements: 4.4, 4.5
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProjectMember, removeProjectMember } from '../api';
import { projectMembersQueryKey } from './use-project-members';
import { projectQueryKey } from './use-project';
import { useSession } from '@/features/auth/hooks';
import type { AddMemberInput } from '../types';

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (data: AddMemberInput) => {
      if (!csrfToken) {
        throw new Error('No CSRF token available');
      }
      return addProjectMember(projectId, data, csrfToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectMembersQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (userId: string) => {
      if (!csrfToken) {
        throw new Error('No CSRF token available');
      }
      return removeProjectMember(projectId, userId, csrfToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectMembersQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
    },
  });
}
