/**
 * Integration tests for authentication flow
 * Tests login, logout, session validation, and lockout flows
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 25.5
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema/index";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  validateCsrfToken,
} from "@/lib/auth/session";
import {
  recordFailedAttempt,
  isLocked,
  clearAttempts,
  unlockAccount,
  setRedisClient,
  LOCKOUT_CONFIG,
} from "@/lib/auth/lockout";
import { getMockRedisClient, resetMockRedis } from "../setup/mock-redis";

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

// Helper to create a test user
async function createTestUser(
  id: string,
  email: string,
  password: string,
  role: string = "MEMBER"
) {
  const passwordHash = await hashPassword(password);
  db.run(sql`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (${id}, ${email}, ${passwordHash}, 'Test User', ${role})
  `);
  return { id, email, passwordHash };
}

describe("Authentication Flow Integration Tests", () => {
  beforeEach(() => {
    setupTestDb();
    setRedisClient(getMockRedisClient());
    resetMockRedis();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  afterAll(() => {
    setRedisClient(null);
  });

  describe("Login Flow", () => {
    /**
     * Requirement 1.1: User login with valid credentials
     */
    it("should authenticate user with valid credentials", async () => {
      const userId = "user-1";
      const email = "test@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      // Simulate login: verify password
      const users = db.all(sql`SELECT * FROM users WHERE email = ${email}`);
      expect(users.length).toBe(1);

      const user = users[0] as { password_hash: string; id: string };
      const isValid = await verifyPassword(password, user.password_hash);
      expect(isValid).toBe(true);

      // Create session on successful login
      const session = await createSession(user.id, db);
      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.csrfToken).toBeDefined();
    });

    /**
     * Requirement 1.1: User login with invalid credentials
     */
    it("should reject login with invalid password", async () => {
      const userId = "user-2";
      const email = "test2@example.com";
      const password = "SecurePassword123!";
      const wrongPassword = "WrongPassword456!";

      await createTestUser(userId, email, password);

      const users = db.all(sql`SELECT * FROM users WHERE email = ${email}`);
      const user = users[0] as { password_hash: string };
      const isValid = await verifyPassword(wrongPassword, user.password_hash);
      expect(isValid).toBe(false);
    });

    /**
     * Requirement 1.1: Login with non-existent user
     */
    it("should reject login for non-existent user", async () => {
      const users = db.all(
        sql`SELECT * FROM users WHERE email = ${"nonexistent@example.com"}`
      );
      expect(users.length).toBe(0);
    });
  });

  describe("Logout Flow", () => {
    /**
     * Requirement 1.4: Session invalidation on logout
     */
    it("should invalidate session on logout", async () => {
      const userId = "user-3";
      const email = "test3@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      // Create session (login)
      const session = await createSession(userId, db);
      expect(session).toBeDefined();

      // Verify session is valid
      const validSession = await validateSession(session.id, db);
      expect(validSession).not.toBeNull();

      // Logout (invalidate session)
      await invalidateSession(session.id, db);

      // Verify session is no longer valid
      const invalidatedSession = await validateSession(session.id, db);
      expect(invalidatedSession).toBeNull();
    });

    /**
     * Requirement 1.4: Invalidate all user sessions
     */
    it("should invalidate all sessions for a user", async () => {
      const userId = "user-4";
      const email = "test4@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      // Create multiple sessions
      const session1 = await createSession(userId, db);
      const session2 = await createSession(userId, db);
      const session3 = await createSession(userId, db);

      // Verify all sessions are valid
      expect(await validateSession(session1.id, db)).not.toBeNull();
      expect(await validateSession(session2.id, db)).not.toBeNull();
      expect(await validateSession(session3.id, db)).not.toBeNull();

      // Invalidate all sessions
      await invalidateAllUserSessions(userId, db);

      // Verify all sessions are invalid
      expect(await validateSession(session1.id, db)).toBeNull();
      expect(await validateSession(session2.id, db)).toBeNull();
      expect(await validateSession(session3.id, db)).toBeNull();
    });
  });

  describe("Session Validation", () => {
    /**
     * Requirement 1.5: Protected routes require valid session
     */
    it("should validate active session", async () => {
      const userId = "user-5";
      const email = "test5@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      const session = await createSession(userId, db);
      const validatedSession = await validateSession(session.id, db);

      expect(validatedSession).not.toBeNull();
      expect(validatedSession?.userId).toBe(userId);
      expect(validatedSession?.csrfToken).toBe(session.csrfToken);
    });

    /**
     * Requirement 1.5: Invalid session ID should be rejected
     */
    it("should reject invalid session ID", async () => {
      const invalidSession = await validateSession("invalid-session-id", db);
      expect(invalidSession).toBeNull();
    });

    /**
     * Requirement 1.5: Expired session should be rejected
     */
    it("should reject expired session", async () => {
      const userId = "user-6";
      const email = "test6@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      const session = await createSession(userId, db);

      // Manually expire the session
      const pastTimestamp = Math.floor((Date.now() - 1000) / 1000);
      db.run(sql`
        UPDATE sessions 
        SET expires_at = ${pastTimestamp}
        WHERE id = ${session.id}
      `);

      const expiredSession = await validateSession(session.id, db);
      expect(expiredSession).toBeNull();
    });

    /**
     * Requirement 1.6: CSRF token validation
     */
    it("should validate correct CSRF token", async () => {
      const userId = "user-7";
      const email = "test7@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      const session = await createSession(userId, db);
      const isValid = await validateCsrfToken(
        session.id,
        session.csrfToken,
        db
      );
      expect(isValid).toBe(true);
    });

    /**
     * Requirement 1.6: Invalid CSRF token should be rejected
     */
    it("should reject invalid CSRF token", async () => {
      const userId = "user-8";
      const email = "test8@example.com";
      const password = "SecurePassword123!";

      await createTestUser(userId, email, password);

      const session = await createSession(userId, db);
      const isValid = await validateCsrfToken(
        session.id,
        "invalid-csrf-token",
        db
      );
      expect(isValid).toBe(false);
    });
  });

  describe("Lockout Flow", () => {
    /**
     * Requirement 1.3: Account lockout after failed attempts
     */
    it("should lock account after max failed attempts", async () => {
      const email = "lockout@example.com";
      const ip = "192.168.1.1";

      // Record max failed attempts
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      const locked = await isLocked(email);
      expect(locked).toBe(true);
    });

    /**
     * Requirement 1.3: Account should not lock before max attempts
     */
    it("should not lock account before max failed attempts", async () => {
      const email = "notlocked@example.com";
      const ip = "192.168.1.2";

      // Record fewer than max attempts
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1; i++) {
        await recordFailedAttempt(email, ip);
      }

      const locked = await isLocked(email);
      expect(locked).toBe(false);
    });

    /**
     * Requirement 1.3: Clear attempts on successful login
     */
    it("should clear attempts on successful login", async () => {
      const email = "clearattempts@example.com";
      const ip = "192.168.1.3";

      // Record some failed attempts
      await recordFailedAttempt(email, ip);
      await recordFailedAttempt(email, ip);

      // Simulate successful login - clear attempts
      await clearAttempts(email);

      // Should be able to fail again without immediate lockout
      const result = await recordFailedAttempt(email, ip);
      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(
        LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1
      );
    });

    /**
     * Requirement 1.3: Admin can unlock account
     */
    it("should allow admin to unlock account", async () => {
      const email = "adminunlock@example.com";
      const ip = "192.168.1.4";

      // Lock the account
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      expect(await isLocked(email)).toBe(true);

      // Admin unlocks
      await unlockAccount(email);

      expect(await isLocked(email)).toBe(false);
    });

    /**
     * Requirement 1.3: Locked account rejects login attempts
     */
    it("should reject login attempts on locked account", async () => {
      const email = "lockedreject@example.com";
      const ip = "192.168.1.5";

      // Lock the account
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      // Try to record another attempt
      const result = await recordFailedAttempt(email, ip);
      expect(result.isLocked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
    });
  });

  describe("Complete Authentication Flow", () => {
    /**
     * Requirement 25.5: Complete authentication flow integration test
     */
    it("should complete full login -> access -> logout flow", async () => {
      const userId = "user-flow";
      const email = "flow@example.com";
      const password = "SecurePassword123!";

      // Step 1: Create user
      await createTestUser(userId, email, password);

      // Step 2: Login - verify credentials
      const users = db.all(sql`SELECT * FROM users WHERE email = ${email}`);
      const user = users[0] as { password_hash: string; id: string };
      const isValid = await verifyPassword(password, user.password_hash);
      expect(isValid).toBe(true);

      // Step 3: Create session
      const session = await createSession(user.id, db);
      expect(session).toBeDefined();

      // Step 4: Access protected resource - validate session
      const validSession = await validateSession(session.id, db);
      expect(validSession).not.toBeNull();
      expect(validSession?.userId).toBe(userId);

      // Step 5: Validate CSRF for state-changing operations
      const csrfValid = await validateCsrfToken(
        session.id,
        session.csrfToken,
        db
      );
      expect(csrfValid).toBe(true);

      // Step 6: Logout
      await invalidateSession(session.id, db);

      // Step 7: Verify session is invalid after logout
      const invalidSession = await validateSession(session.id, db);
      expect(invalidSession).toBeNull();
    });

    /**
     * Requirement 25.5: Failed login with lockout flow
     */
    it("should complete failed login -> lockout -> unlock flow", async () => {
      const userId = "user-lockout-flow";
      const email = "lockoutflow@example.com";
      const password = "SecurePassword123!";
      const wrongPassword = "WrongPassword!";
      const ip = "192.168.1.100";

      // Step 1: Create user
      await createTestUser(userId, email, password);

      // Step 2: Multiple failed login attempts
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        const users = db.all(sql`SELECT * FROM users WHERE email = ${email}`);
        const user = users[0] as { password_hash: string };
        const isValid = await verifyPassword(wrongPassword, user.password_hash);
        expect(isValid).toBe(false);

        await recordFailedAttempt(email, ip);
      }

      // Step 3: Verify account is locked
      expect(await isLocked(email)).toBe(true);

      // Step 4: Admin unlocks account
      await unlockAccount(email);
      expect(await isLocked(email)).toBe(false);

      // Step 5: Successful login after unlock
      const users = db.all(sql`SELECT * FROM users WHERE email = ${email}`);
      const user = users[0] as { password_hash: string; id: string };
      const isValid = await verifyPassword(password, user.password_hash);
      expect(isValid).toBe(true);

      // Step 6: Clear attempts and create session
      await clearAttempts(email);
      const session = await createSession(user.id, db);
      expect(session).toBeDefined();
    });
  });
});
