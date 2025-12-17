/**
 * Property-based tests for session management
 */
import { describe, it, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema/index";
import {
  createSession,
  validateSession,
  invalidateSession,
  generateSessionId,
} from "@/lib/auth/session";

// Test database setup
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

function setupTestDb() {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema });

  // Create users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      avatar_url TEXT,
      theme_preference TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create index
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`
  );
}

function cleanupTestDb() {
  if (sqlite) {
    sqlite.close();
  }
}

// UUID generator for test user IDs
const uuidArbitrary = fc.uuid();

describe("Session Management Properties", () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * **Feature: mmc-app, Property 1: Authentication Round-Trip**
   * *For any* valid user credentials (email and password), creating a session
   * and then validating that session should return the same user ID.
   * **Validates: Requirements 1.1, 1.4**
   */
  it("Property 1: Authentication Round-Trip - session creation and validation returns same user ID", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArbitrary, async (userId) => {
        // First, create a test user
        db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

        // Create a session for the user
        const session = await createSession(userId, db);

        // Validate the session
        const validatedSession = await validateSession(session.id, db);

        // The validated session should return the same user ID
        return validatedSession !== null && validatedSession.userId === userId;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 1: Authentication Round-Trip**
   * After invalidating a session, validation should return null.
   * **Validates: Requirements 1.1, 1.4**
   */
  it("Property 1: Authentication Round-Trip - invalidated session returns null", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArbitrary, async (userId) => {
        // Create a test user
        db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

        // Create a session
        const session = await createSession(userId, db);

        // Invalidate the session
        await invalidateSession(session.id, db);

        // Validation should return null
        const validatedSession = await validateSession(session.id, db);

        return validatedSession === null;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 1: Authentication Round-Trip**
   * Session should contain a valid CSRF token.
   * **Validates: Requirements 1.1, 1.4**
   */
  it("Property 1: Authentication Round-Trip - session contains CSRF token", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArbitrary, async (userId) => {
        // Create a test user
        db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

        // Create a session
        const session = await createSession(userId, db);

        // Session should have a CSRF token
        return (
          session.csrfToken !== undefined &&
          session.csrfToken.length === 64 && // 32 bytes hex encoded
          /^[a-f0-9]+$/i.test(session.csrfToken)
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 2: Session Protection**
   * *For any* protected route and any request without a valid session,
   * the system should redirect to the login page or return 401 Unauthorized.
   *
   * This test validates that:
   * - Random/invalid session IDs return null (unauthenticated)
   * - Non-existent session IDs return null
   * **Validates: Requirements 1.5**
   */
  it("Property 2: Session Protection - invalid session IDs return null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (randomSessionId) => {
          // Any random string that is not a valid session should return null
          const validatedSession = await validateSession(randomSessionId, db);

          // Invalid session should return null (unauthenticated)
          return validatedSession === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 2: Session Protection**
   * *For any* properly formatted but non-existent session ID,
   * the system should return null (unauthenticated).
   * **Validates: Requirements 1.5**
   */
  it("Property 2: Session Protection - non-existent session IDs return null", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async () => {
        // Generate a properly formatted session ID that doesn't exist
        const nonExistentSessionId = generateSessionId();

        // Non-existent session should return null
        const validatedSession = await validateSession(
          nonExistentSessionId,
          db
        );

        return validatedSession === null;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 2: Session Protection**
   * *For any* expired session, the system should return null (unauthenticated).
   * **Validates: Requirements 1.5**
   */
  it("Property 2: Session Protection - expired sessions return null", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArbitrary, async (userId) => {
        // Create a test user
        db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

        // Create a session
        const session = await createSession(userId, db);

        // Manually expire the session by setting expiresAt to the past
        // SQLite stores dates as Unix timestamps (seconds), so we convert
        const pastTimestamp = Math.floor((Date.now() - 1000) / 1000); // 1 second ago in Unix seconds
        db.run(sql`
          UPDATE sessions 
          SET expires_at = ${pastTimestamp}
          WHERE id = ${session.id}
        `);

        // Expired session should return null
        const validatedSession = await validateSession(session.id, db);

        return validatedSession === null;
      }),
      { numRuns: 100 }
    );
  });
});
