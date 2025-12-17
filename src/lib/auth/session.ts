/**
 * Session management service
 * Requirements: 1.1, 1.4, 1.6 - Session creation, invalidation, and CSRF protection
 */
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { sessionsSqlite } from "@/lib/db/schema/sessions";

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Session refresh threshold: refresh if less than 1 day remaining
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Allow injecting a different database for testing
// Using a structural type that accepts any compatible Drizzle database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbInstance = any;

export interface SessionData {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Generate a secure random ID
 * @param length - Number of bytes (will be hex encoded, so output is 2x length)
 */
function generateSecureId(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return generateSecureId(32);
}

/**
 * Generate a secure CSRF token
 */
export function generateCsrfToken(): string {
  return generateSecureId(32);
}

/**
 * Create a new session for a user
 * @param userId - The user ID to create a session for
 * @param db - Optional database instance (defaults to main db)
 * @returns The created session data
 */
export async function createSession(
  userId: string,
  db: DbInstance = defaultDb
): Promise<SessionData> {
  const id = generateSessionId();
  const csrfToken = generateCsrfToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await db.insert(sessionsSqlite).values({
    id,
    userId,
    csrfToken,
    expiresAt,
    createdAt: now,
  });

  return {
    id,
    userId,
    csrfToken,
    expiresAt,
    createdAt: now,
  };
}

/**
 * Validate a session by ID
 * @param sessionId - The session ID to validate
 * @param db - Optional database instance (defaults to main db)
 * @returns The session data if valid, null otherwise
 */
export async function validateSession(
  sessionId: string,
  db: DbInstance = defaultDb
): Promise<SessionData | null> {
  const now = new Date();

  const sessions = await db
    .select()
    .from(sessionsSqlite)
    .where(
      and(eq(sessionsSqlite.id, sessionId), gt(sessionsSqlite.expiresAt, now))
    )
    .limit(1);

  if (sessions.length === 0) {
    return null;
  }

  const session = sessions[0];
  return {
    id: session.id,
    userId: session.userId,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  };
}

/**
 * Invalidate (delete) a session
 * @param sessionId - The session ID to invalidate
 * @param db - Optional database instance (defaults to main db)
 */
export async function invalidateSession(
  sessionId: string,
  db: DbInstance = defaultDb
): Promise<void> {
  await db.delete(sessionsSqlite).where(eq(sessionsSqlite.id, sessionId));
}

/**
 * Invalidate all sessions for a user
 * @param userId - The user ID to invalidate sessions for
 * @param db - Optional database instance (defaults to main db)
 */
export async function invalidateAllUserSessions(
  userId: string,
  db: DbInstance = defaultDb
): Promise<void> {
  await db.delete(sessionsSqlite).where(eq(sessionsSqlite.userId, userId));
}

/**
 * Refresh a session if it's close to expiring
 * @param sessionId - The session ID to refresh
 * @param db - Optional database instance (defaults to main db)
 * @returns The refreshed session data, or null if session is invalid
 */
export async function refreshSession(
  sessionId: string,
  db: DbInstance = defaultDb
): Promise<SessionData | null> {
  const session = await validateSession(sessionId, db);

  if (!session) {
    return null;
  }

  const now = new Date();
  const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();

  // Only refresh if close to expiring
  if (timeUntilExpiry > SESSION_REFRESH_THRESHOLD_MS) {
    return session;
  }

  // Extend the session
  const newExpiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await db
    .update(sessionsSqlite)
    .set({ expiresAt: newExpiresAt })
    .where(eq(sessionsSqlite.id, sessionId));

  return {
    ...session,
    expiresAt: newExpiresAt,
  };
}

/**
 * Validate a CSRF token against a session
 * @param sessionId - The session ID
 * @param csrfToken - The CSRF token to validate
 * @param db - Optional database instance (defaults to main db)
 * @returns True if the token is valid, false otherwise
 */
export async function validateCsrfToken(
  sessionId: string,
  csrfToken: string,
  db: DbInstance = defaultDb
): Promise<boolean> {
  const session = await validateSession(sessionId, db);

  if (!session) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(session.csrfToken, csrfToken);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
