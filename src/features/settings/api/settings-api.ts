/**
 * Settings API Functions
 *
 * Requirements:
 * - 16.3: Theme preference management
 * - 16.4: Profile update
 */
import type {
  UserProfile,
  UpdateProfileRequest,
  UpdateThemeRequest,
  UpdateThemeResponse,
} from "../types";

/**
 * Get current user profile
 */
export async function getUserProfile(): Promise<UserProfile> {
  const response = await fetch("/api/users/me", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch profile");
  }

  return response.json();
}

/**
 * Update current user profile
 */
export async function updateUserProfile(
  data: UpdateProfileRequest,
  csrfToken: string
): Promise<UserProfile> {
  const response = await fetch("/api/users/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update profile");
  }

  return response.json();
}

/**
 * Update user theme preference
 */
export async function updateThemePreference(
  data: UpdateThemeRequest,
  csrfToken: string
): Promise<UpdateThemeResponse> {
  const response = await fetch("/api/users/me/theme", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update theme");
  }

  return response.json();
}
