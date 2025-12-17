/**
 * Login Page Route
 *
 * Requirements:
 * - 1.1: Login with email/password and redirect to dashboard on success
 */
import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  LoginForm,
  useLogin,
  useSession,
  type LoginFormData,
} from "@/features/auth";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const [error, setError] = React.useState<string | null>(null);
  const [lockoutMinutes, setLockoutMinutes] = React.useState<number | null>(
    null
  );

  const loginMutation = useLogin({
    onSuccess: (data) => {
      if (data.success) {
        // Redirect to dashboard on successful login
        navigate({ to: "/app/dashboard" });
      } else {
        // Handle error response
        setError(data.error || "Login failed");
        if (data.lockoutMinutes) {
          setLockoutMinutes(data.lockoutMinutes);
        }
      }
    },
    onError: (err) => {
      setError(err.message || "An unexpected error occurred");
    },
  });

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !sessionLoading) {
      navigate({ to: "/app/dashboard" });
    }
  }, [isAuthenticated, sessionLoading, navigate]);

  const handleSubmit = async (data: LoginFormData) => {
    // Clear previous errors
    setError(null);
    setLockoutMinutes(null);

    // Attempt login
    await loginMutation.mutateAsync(data);
  };

  // Show nothing while checking session
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <LoginForm
      onSubmit={handleSubmit}
      isLoading={loginMutation.isPending}
      error={error}
      lockoutMinutes={lockoutMinutes}
    />
  );
}
