/**
 * Auth API Functions
 *
 * Requirements:
 * - 1.1: Login with email/password
 * - 1.4: Logout and invalidate session
 * - 1.5: Session validation
 */
import type { LoginRequest, LoginResponse, LogoutResponse, SessionResponse } from '../types';

/**
 * Login with email and password
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  return response.json();
}

/**
 * Logout and invalidate session
 */
export async function logout(csrfToken: string): Promise<LogoutResponse> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  });

  return response.json();
}

/**
 * Get current session
 */
export async function getSession(): Promise<SessionResponse> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
  });

  return response.json();
}
