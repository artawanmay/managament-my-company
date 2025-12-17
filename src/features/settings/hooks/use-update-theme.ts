/**
 * Update Theme Mutation Hook
 *
 * Requirements:
 * - 16.1: Light theme support
 * - 16.2: Dark theme support
 * - 16.3: Theme preference persistence
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateThemePreference } from "../api";
import { useSession } from "@/features/auth/hooks";
import type { ThemePreference } from "../types";

export function useUpdateTheme() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: (theme: ThemePreference) => {
      if (!csrfToken) {
        throw new Error("No CSRF token available");
      }
      return updateThemePreference({ theme }, csrfToken);
    },
    onSuccess: (response) => {
      // Update profile cache with new theme
      queryClient.setQueryData(["profile"], (old: unknown) => {
        if (old && typeof old === "object") {
          return { ...old, themePreference: response.themePreference };
        }
        return old;
      });
      // Invalidate session to refresh user data
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
}
