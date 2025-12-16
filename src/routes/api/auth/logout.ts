/**
 * Logout API Route
 * POST /api/auth/logout
 *
 * Requirements:
 * - 1.4: Invalidate session and redirect to login page
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import {
  invalidateSession,
  extractSessionIdFromCookie,
  csrfMiddleware,
} from '@/lib/auth';

interface LogoutResponse {
  success: boolean;
  error?: string;
}

// Cookie string to clear the session
const CLEAR_SESSION_COOKIE =
  'session_id=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Validate CSRF token for mutation request
          const csrfResult = await csrfMiddleware(request);
          if (!csrfResult.valid) {
            return json<LogoutResponse>(
              { success: false, error: csrfResult.error || 'CSRF validation failed' },
              { status: 403 }
            );
          }

          // Extract session ID from cookie
          const cookieHeader = request.headers.get('cookie');
          const sessionId = extractSessionIdFromCookie(cookieHeader);

          if (sessionId) {
            // Invalidate the session
            await invalidateSession(sessionId);
          }

          // Return success with cleared session cookie
          return json<LogoutResponse>(
            { success: true },
            {
              status: 200,
              headers: {
                'Set-Cookie': CLEAR_SESSION_COOKIE,
              },
            }
          );
        } catch (error) {
          console.error('[Logout] Error:', error);
          return json<LogoutResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
          );
        }
      },
    },
  },
});
