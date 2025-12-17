/**
 * useResetPassword Hook - Reset user password (SUPER_ADMIN only)
 */
import { useMutation } from "@tanstack/react-query";

interface ResetPasswordData {
  userId: string;
  newPassword: string;
}

async function resetPassword({ userId, newPassword }: ResetPasswordData) {
  const csrfToken = sessionStorage.getItem("csrf_token");
  const response = await fetch(`/api/users/${userId}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    },
    body: JSON.stringify({ newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reset password");
  }

  return response.json();
}

export function useResetPassword() {
  return useMutation({
    mutationFn: resetPassword,
  });
}
