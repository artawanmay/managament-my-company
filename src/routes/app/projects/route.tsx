/**
 * Projects layout route
 * This layout route allows child routes (like $projectId) to render via Outlet
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/projects')({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return <Outlet />;
}
