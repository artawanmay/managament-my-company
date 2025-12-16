/**
 * Auth Feature Types
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  themePreference?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  lockoutMinutes?: number;
  user?: User;
  csrfToken?: string;
}

export interface LogoutResponse {
  success: boolean;
  error?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: User;
  csrfToken?: string;
  expiresAt?: string;
}
