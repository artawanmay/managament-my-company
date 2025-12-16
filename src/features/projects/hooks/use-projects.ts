/**
 * useProjects hook for fetching project list
 * Requirements: 4.1, 4.2
 */
import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '../api';
import type { ProjectListParams } from '../types';

export const projectsQueryKey = (params: ProjectListParams = {}) => ['projects', params];

export function useProjects(params: ProjectListParams = {}) {
  return useQuery({
    queryKey: projectsQueryKey(params),
    queryFn: () => fetchProjects(params),
  });
}
