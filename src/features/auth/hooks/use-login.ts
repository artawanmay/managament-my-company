/**
 * useLogin Hook
 *
 * Requirements:
 * - 1.1: Login mutation with TanStack Query
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/auth-api";
import type { LoginRequest, LoginResponse } from "../types";

interface UseLoginOptions {
  onSuccess?: (data: LoginResponse) => void;
  onError?: (error: Error) => void;
}

export function useLogin(options?: UseLoginOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => login(data),
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate session query to refetch user data
        queryClient.invalidateQueries({ queryKey: ["session"] });
        // Store CSRF token in memory for subsequent requests
        if (data.csrfToken) {
          sessionStorage.setItem("csrf_token", data.csrfToken);
        }
      }
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
