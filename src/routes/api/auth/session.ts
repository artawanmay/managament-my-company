/**
 * Session Check API Route
 * GET /api/auth/session
 *
 * Requirements:
 * - 1.5: Validate current session and return user info
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usersSqlite } from '@/lib/db/schema/users';
import { refreshSession, extractSessionIdFromCookie } from '@/lib/auth';

interface SessionResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl: string | null;
    themePreference: string;
  };
  csrfToken?: string;
  expiresAt?: string;
}

// Cookie string to clear the session
const CLEAR_SESSION_COOKIE =
  'session_id=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

export const Route = createFileRoute('/api/auth/session')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          // Extract session ID from cookie
          const cookieHeader = request.headers.get('cookie');
          const sessionId = extractSessionIdFromCookie(cookieHeader);

          if (!sessionId) {
            return json<SessionResponse>({ authenticated: false });
          }

          // Validate and potentially refresh the session
          const session = await refreshSession(sessionId);

          if (!session) {
            // Session is invalid or expired
            return json<SessionResponse>(
              { authenticated: false },
              {
                headers: {
                  'Set-Cookie': CLEAR_SESSION_COOKIE,
                },
              }
            );
          }

          // Fetch user data
          const users = await db
            .select({
              id: usersSqlite.id,
              email: usersSqlite.email,
              name: usersSqlite.name,
              role: usersSqlite.role,
              avatarUrl: usersSqlite.avatarUrl,
              themePreference: usersSqlite.themePreference,
            })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, session.userId))
            .limit(1);

          const user = users[0];

          if (!user) {
            // User no longer exists, invalidate session
            return json<SessionResponse>(
              { authenticated: false },
              {
                headers: {
                  'Set-Cookie': CLEAR_SESSION_COOKIE,
                },
              }
            );
          }

          // Build response headers
          const headers: Record<string, string> = {};

          // If session was refreshed, update the cookie
          if (session.expiresAt.getTime() > Date.now() + 6 * 24 * 60 * 60 * 1000) {
            // Session was refreshed (more than 6 days remaining means it was extended)
            headers['Set-Cookie'] = createSessionCookie(session.id, session.expiresAt);
          }

          // Return authenticated session info
          return json<SessionResponse>(
            {
              authenticated: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl,
                themePreference: user.themePreference,
              },
              csrfToken: session.csrfToken,
              expiresAt: session.expiresAt.toISOString(),
            },
            Object.keys(headers).length > 0 ? { headers } : undefined
          );
        } catch (error) {
          console.error('[Session] Error:', error);
          return json<SessionResponse>({ authenticated: false });
        }
      },
    },
  },
});

/**
 * Create a session cookie string
 */
function createSessionCookie(sessionId: string, expiresAt: Date): string {
  const cookieOptions = [
    `session_id=${sessionId}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Expires=${expiresAt.toUTCString()}`,
  ];

  // Add Secure flag in production
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  return cookieOptions.join('; ');
}
