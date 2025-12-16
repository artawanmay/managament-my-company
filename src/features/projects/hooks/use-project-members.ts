/**
 * useProjectMembers hook for fetching project members
 * Requirements: 4.4, 4.5
 */
import { useQuery } from '@tanstack/react-query';
import { fetchProjectMembers } from '../api';

export const projectMembersQueryKey = (projectId: string) => ['project-members', projectId];

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectMembersQueryKey(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    enabled: !!projectId,
  });
}
