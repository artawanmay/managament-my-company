/**
 * Login API Route
 * POST /api/auth/login
 *
 * Requirements:
 * - 1.1: Create authenticated session on valid credentials
 * - 1.2: Display error without revealing which field is incorrect
 * - 1.3: Lock account after 5 failed attempts within 15 minutes
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usersSqlite } from '@/lib/db/schema/users';
import {
  verifyPassword,
  createSession,
  isLocked,
  recordFailedAttempt,
  clearAttempts,
  getRemainingLockoutTime,
} from '@/lib/auth';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  lockoutMinutes?: number;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  csrfToken?: string;
}

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Parse request body
          const body: LoginRequest = await request.json();
          const { email, password } = body;

          // Validate input
          if (!email || !password) {
            return json<LoginResponse>(
              { success: false, error: 'Email and password are required' },
              { status: 400 }
            );
          }

          // Normalize email
          const normalizedEmail = email.toLowerCase().trim();

          // Get client IP for lockout tracking
          const ip = getClientIp(request);

          // Check if account is locked
          const locked = await isLocked(normalizedEmail);
          if (locked) {
            const remainingTime = await getRemainingLockoutTime(normalizedEmail);
            const lockoutMinutes = Math.ceil(remainingTime / 60);
            return json<LoginResponse>(
              {
                success: false,
                error: `Account is temporarily locked. Please try again in ${lockoutMinutes} minutes.`,
                lockoutMinutes,
              },
              { status: 429 }
            );
          }

          // Find user by email
          const users = await db
            .select()
            .from(usersSqlite)
            .where(eq(usersSqlite.email, normalizedEmail))
            .limit(1);

          const user = users[0];

          // Verify credentials - use generic error message (Requirement 1.2)
          if (!user) {
            // Record failed attempt even for non-existent users to prevent enumeration
            const lockoutResult = await recordFailedAttempt(normalizedEmail, ip);
            if (lockoutResult.isLocked) {
              return json<LoginResponse>(
                {
                  success: false,
                  error: 'Account is temporarily locked due to too many failed attempts. Please try again in 30 minutes.',
                  lockoutMinutes: 30,
                },
                { status: 429 }
              );
            }
            return json<LoginResponse>(
              { success: false, error: 'Invalid email or password' },
              { status: 401 }
            );
          }

          // Verify password
          const passwordValid = await verifyPassword(password, user.passwordHash);
          if (!passwordValid) {
            const lockoutResult = await recordFailedAttempt(normalizedEmail, ip);
            if (lockoutResult.isLocked) {
              return json<LoginResponse>(
                {
                  success: false,
                  error: 'Account is temporarily locked due to too many failed attempts. Please try again in 30 minutes.',
                  lockoutMinutes: 30,
                },
                { status: 429 }
              );
            }
            return json<LoginResponse>(
              { success: false, error: 'Invalid email or password' },
              { status: 401 }
            );
          }

          // Clear failed attempts on successful login
          await clearAttempts(normalizedEmail);

          // Create session
          const session = await createSession(user.id);

          // Create response with session cookie
          const response = json<LoginResponse>(
            {
              success: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              },
              csrfToken: session.csrfToken,
            },
            {
              status: 200,
              headers: {
                'Set-Cookie': createSessionCookie(session.id, session.expiresAt),
              },
            }
          );

          return response;
        } catch (error) {
          console.error('[Login] Error:', error);
          return json<LoginResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
          );
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

/**
 * Extract client IP from request headers
 */
function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0];
    if (firstIp) {
      return firstIp.trim();
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to unknown
  return 'unknown';
}
