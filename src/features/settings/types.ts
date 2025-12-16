/**
 * Settings Feature Types
 *
 * Requirements:
 * - 16.3: Theme preference management
 * - 16.4: Profile update
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  themePreference: ThemePreference;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface UpdateThemeRequest {
  theme: ThemePreference;
}

export interface UpdateThemeResponse {
  themePreference: ThemePreference;
}
