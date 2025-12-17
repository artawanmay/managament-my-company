/**
 * Clients layout route
 * Provides layout wrapper for clients pages
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/clients")({
  component: ClientsLayout,
});

function ClientsLayout() {
  return <Outlet />;
}
