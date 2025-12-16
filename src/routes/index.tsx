import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // TODO: Check if user is authenticated
    // For now, redirect to dashboard. Once auth is implemented,
    // this will check session and redirect to login if not authenticated
    const isAuthenticated = false; // Will be replaced with actual session check

    if (isAuthenticated) {
      throw redirect({ to: "/app/dashboard" });
    } else {
      throw redirect({ to: "/auth/login" });
    }
  },
});
