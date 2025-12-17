/**
 * Property-based tests for CSRF protection
 */
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import * as fc from "fast-check";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema/index";
import { createSession, validateCsrfToken } from "@/lib/auth/session";
import {
  validateCsrfRequest,
  requiresCsrfProtection,
  extractSessionIdFromCookie,
  extractCsrfToken,
  CSRF_HEADER,
} from "@/lib/auth/csrf";

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

// Hex string generator (simpler than stringMatching)
const hexStringArbitrary = (length: number) =>
  fc
    .array(fc.integer({ min: 0, max: 15 }), {
      minLength: length,
      maxLength: length,
    })
    .map((arr) => arr.map((n) => n.toString(16)).join(""));

describe("CSRF Protection Properties", () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * *For any* mutation request with cookie-based session, the request should be
   * rejected if the CSRF token is missing or invalid.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - valid token is accepted", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArbitrary, async (userId) => {
        // Create a test user
        db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

        // Create a session
        const session = await createSession(userId, db);

        // Validate with correct CSRF token
        const isValid = await validateCsrfToken(
          session.id,
          session.csrfToken,
          db
        );

        return isValid === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * Invalid CSRF token should be rejected.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - invalid token is rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArbitrary,
        hexStringArbitrary(64),
        async (userId, wrongToken) => {
          // Create a test user
          db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

          // Create a session
          const session = await createSession(userId, db);

          // Skip if the random token happens to match (extremely unlikely)
          fc.pre(wrongToken !== session.csrfToken);

          // Validate with wrong CSRF token
          const isValid = await validateCsrfToken(session.id, wrongToken, db);

          return isValid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * Missing CSRF token should be rejected.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - missing token is rejected", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArbitrary, async (userId) => {
        // Create a test user
        db.run(sql`
          INSERT INTO users (id, email, password_hash, name, role)
          VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
        `);

        // Create a session
        const session = await createSession(userId, db);

        // Validate with null CSRF token
        const result = await validateCsrfRequest(session.id, null, db);

        return result.valid === false && result.error === "CSRF token missing";
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * Missing session should be rejected.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - missing session is rejected", async () => {
    await fc.assert(
      fc.asyncProperty(hexStringArbitrary(64), async (csrfToken) => {
        // Validate with null session
        const result = await validateCsrfRequest(null, csrfToken, db);

        return result.valid === false && result.error === "No session found";
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * Mutation methods require CSRF protection.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - mutation methods require protection", () => {
    const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];
    const safeMethods = ["GET", "HEAD", "OPTIONS"];

    // All mutation methods should require protection
    for (const method of mutationMethods) {
      expect(requiresCsrfProtection(method)).toBe(true);
      expect(requiresCsrfProtection(method.toLowerCase())).toBe(true);
    }

    // Safe methods should not require protection
    for (const method of safeMethods) {
      expect(requiresCsrfProtection(method)).toBe(false);
      expect(requiresCsrfProtection(method.toLowerCase())).toBe(false);
    }
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * Session ID extraction from cookies works correctly.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - session ID extraction from cookies", () => {
    fc.assert(
      fc.property(hexStringArbitrary(64), (sessionId) => {
        const cookieHeader = `session_id=${sessionId}; other_cookie=value`;
        const extracted = extractSessionIdFromCookie(cookieHeader);
        return extracted === sessionId;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property 3: CSRF Token Validation**
   * CSRF token extraction from headers works correctly.
   * **Validates: Requirements 1.6, 18.2**
   */
  it("Property 3: CSRF Token Validation - CSRF token extraction from headers", () => {
    fc.assert(
      fc.property(hexStringArbitrary(64), (csrfToken) => {
        // Test with Headers object
        const headers = new Headers();
        headers.set(CSRF_HEADER, csrfToken);
        const extracted = extractCsrfToken(headers);
        return extracted === csrfToken;
      }),
      { numRuns: 100 }
    );
  });
});
