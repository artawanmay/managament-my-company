/**
 * Project detail layout route
 * Requirements: 4.3
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/projects/$projectId')({
  component: ProjectLayout,
});

function ProjectLayout() {
  return <Outlet />;
}
