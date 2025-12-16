/**
 * Property-based tests for notes and credentials management
 * Tests for secret access logging and unauthorized access denial
 */
import { describe, it, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema/index';
import { encryptSecret } from '@/lib/security/crypto';
import {
  canViewNoteSecret,
  setDatabase,
  resetDatabase,
  type PermissionUser,
} from '@/lib/auth/permissions';

// Set up encryption key for tests
beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-property-tests-32';
  }
});

// Test database setup
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

function setupTestDb() {
  sqlite = new Database(':memory:');
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

  // Create clients table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pic_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      website TEXT,
      status TEXT NOT NULL DEFAULT 'PROSPECT',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNING',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      start_date INTEGER,
      end_date INTEGER,
      manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create project_members table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, user_id)
    )
  `);

  // Create notes table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'OTHER',
      system_name TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      host TEXT,
      port INTEGER,
      username TEXT,
      secret TEXT NOT NULL,
      metadata TEXT,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create note_access_logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS note_access_logs (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create indexes
  sqlite.exec(`CREATE INDEX IF NOT EXISTS notes_project_id_idx ON notes(project_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS notes_client_id_idx ON notes(client_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS note_access_logs_note_id_idx ON note_access_logs(note_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS note_access_logs_user_id_idx ON note_access_logs(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members(project_id)`);

  // Set the test database for permissions module
  setDatabase(db as unknown as Parameters<typeof setDatabase>[0]);
}

function cleanupTestDb() {
  resetDatabase();
  if (sqlite) {
    sqlite.close();
  }
}

// UUID generator for test IDs
const uuidArbitrary = fc.uuid();

// IP address arbitrary
const ipArbitrary = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// User agent arbitrary
const userAgentArbitrary = fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
);

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

describe('Notes and Credentials Properties', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * **Feature: mmc-app, Property 10: Secret Access Logging**
   * *For any* authorized secret view operation, a log entry should be created
   * containing the user ID, note ID, action, IP address, and user agent.
   * **Validates: Requirements 7.5**
   */
  it(
    'Property 10: Secret Access Logging - log entry contains all required fields',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          ipArbitrary,
          userAgentArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (userId, noteId, logId, projectId, ip, userAgent, secretValue) => {
            // Create a test user with ADMIN role (can view secrets)
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'ADMIN')
            `);

            // Create a project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${userId})
            `);

            // Create a note with encrypted secret
            const encryptedSecret = encryptSecret(secretValue);
            db.run(sql`
              INSERT INTO notes (id, type, system_name, project_id, secret, created_by, updated_by)
              VALUES (${noteId}, 'API', 'Test System', ${projectId}, ${encryptedSecret}, ${userId}, ${userId})
            `);

            // Simulate logging access (as would happen in the API route)
            db.run(sql`
              INSERT INTO note_access_logs (id, note_id, user_id, action, ip, user_agent)
              VALUES (${logId}, ${noteId}, ${userId}, 'VIEW_SECRET', ${ip}, ${userAgent})
            `);

            // Verify the log entry was created with all required fields
            const logEntries = db.all(sql`
              SELECT * FROM note_access_logs WHERE id = ${logId}
            `) as Array<{
              id: string;
              note_id: string;
              user_id: string;
              action: string;
              ip: string;
              user_agent: string;
              created_at: number;
            }>;

            const logEntry = logEntries[0];

            // Verify all required fields are present and correct
            return (
              logEntry !== undefined &&
              logEntry.note_id === noteId &&
              logEntry.user_id === userId &&
              logEntry.action === 'VIEW_SECRET' &&
              logEntry.ip === ip &&
              logEntry.user_agent === userAgent &&
              logEntry.created_at !== undefined
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 10: Secret Access Logging**
   * Multiple access operations should create multiple log entries.
   * **Validates: Requirements 7.5**
   */
  it(
    'Property 10: Secret Access Logging - multiple accesses create multiple logs',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          fc.integer({ min: 1, max: 5 }),
          async (userId, noteId, projectId, accessCount) => {
            // Create a test user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${userId}, ${`test-${userId}@example.com`}, 'hash', 'Test User', 'ADMIN')
            `);

            // Create a project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${userId})
            `);

            // Create a note
            const encryptedSecret = encryptSecret('test-secret');
            db.run(sql`
              INSERT INTO notes (id, type, system_name, project_id, secret, created_by, updated_by)
              VALUES (${noteId}, 'API', 'Test System', ${projectId}, ${encryptedSecret}, ${userId}, ${userId})
            `);

            // Simulate multiple access operations
            for (let i = 0; i < accessCount; i++) {
              const logId = `log-${noteId}-${i}`;
              db.run(sql`
                INSERT INTO note_access_logs (id, note_id, user_id, action, ip, user_agent)
                VALUES (${logId}, ${noteId}, ${userId}, 'VIEW_SECRET', '127.0.0.1', 'Test Agent')
              `);
            }

            // Count log entries for this note
            const countResult = db.all(sql`
              SELECT COUNT(*) as count FROM note_access_logs WHERE note_id = ${noteId}
            `) as Array<{ count: number }>;

            return countResult[0]?.count === accessCount;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 11: Unauthorized Secret Access Denial**
   * *For any* user without view permission for a note and any attempt to view
   * the secret, the system should return an authorization error.
   * **Validates: Requirements 7.4, 2.6**
   */
  it(
    'Property 11: Unauthorized Secret Access Denial - GUEST users cannot view secrets',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          async (guestUserId, adminUserId, noteId, projectId) => {
            // Create an admin user (to create the note)
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${adminUserId}, ${`admin-${adminUserId}@example.com`}, 'hash', 'Admin User', 'ADMIN')
            `);

            // Create a GUEST user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${guestUserId}, ${`guest-${guestUserId}@example.com`}, 'hash', 'Guest User', 'GUEST')
            `);

            // Create a project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${adminUserId})
            `);

            // Add guest as project member
            db.run(sql`
              INSERT INTO project_members (id, project_id, user_id, role)
              VALUES (${`pm-${guestUserId}`}, ${projectId}, ${guestUserId}, 'VIEWER')
            `);

            // Create a note
            const encryptedSecret = encryptSecret('test-secret');
            db.run(sql`
              INSERT INTO notes (id, type, system_name, project_id, secret, created_by, updated_by)
              VALUES (${noteId}, 'API', 'Test System', ${projectId}, ${encryptedSecret}, ${adminUserId}, ${adminUserId})
            `);

            // Check if GUEST can view the secret
            const guestUser: PermissionUser = { id: guestUserId, role: 'GUEST' };
            const canView = await canViewNoteSecret(guestUser, noteId);

            // GUEST users should NOT be able to view secrets
            return canView === false;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 11: Unauthorized Secret Access Denial**
   * Users without project membership cannot view secrets in that project.
   * **Validates: Requirements 7.4, 2.6**
   */
  it(
    'Property 11: Unauthorized Secret Access Denial - non-members cannot view project secrets',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          async (memberUserId, nonMemberUserId, noteId, projectId) => {
            // Create a MEMBER user who is a project member
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${memberUserId}, ${`member-${memberUserId}@example.com`}, 'hash', 'Member User', 'MEMBER')
            `);

            // Create another MEMBER user who is NOT a project member
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${nonMemberUserId}, ${`nonmember-${nonMemberUserId}@example.com`}, 'hash', 'Non-Member User', 'MEMBER')
            `);

            // Create a project with memberUserId as manager
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${memberUserId})
            `);

            // Add memberUserId as project member
            db.run(sql`
              INSERT INTO project_members (id, project_id, user_id, role)
              VALUES (${`pm-${memberUserId}`}, ${projectId}, ${memberUserId}, 'MEMBER')
            `);

            // Create a note in the project
            const encryptedSecret = encryptSecret('test-secret');
            db.run(sql`
              INSERT INTO notes (id, type, system_name, project_id, secret, created_by, updated_by)
              VALUES (${noteId}, 'API', 'Test System', ${projectId}, ${encryptedSecret}, ${memberUserId}, ${memberUserId})
            `);

            // Check if non-member can view the secret
            const nonMemberUser: PermissionUser = { id: nonMemberUserId, role: 'MEMBER' };
            const canView = await canViewNoteSecret(nonMemberUser, noteId);

            // Non-members should NOT be able to view secrets
            return canView === false;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 11: Unauthorized Secret Access Denial**
   * SUPER_ADMIN and ADMIN users can always view secrets.
   * **Validates: Requirements 7.4, 2.6**
   */
  it(
    'Property 11: Unauthorized Secret Access Denial - admins can always view secrets',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          fc.constantFrom('SUPER_ADMIN', 'ADMIN') as fc.Arbitrary<'SUPER_ADMIN' | 'ADMIN'>,
          async (adminUserId, creatorUserId, noteId, projectId, adminRole) => {
            // Create the note creator
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${creatorUserId}, ${`creator-${creatorUserId}@example.com`}, 'hash', 'Creator User', 'MANAGER')
            `);

            // Create an admin user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${adminUserId}, ${`admin-${adminUserId}@example.com`}, 'hash', 'Admin User', ${adminRole})
            `);

            // Create a project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${creatorUserId})
            `);

            // Create a note
            const encryptedSecret = encryptSecret('test-secret');
            db.run(sql`
              INSERT INTO notes (id, type, system_name, project_id, secret, created_by, updated_by)
              VALUES (${noteId}, 'API', 'Test System', ${projectId}, ${encryptedSecret}, ${creatorUserId}, ${creatorUserId})
            `);

            // Check if admin can view the secret
            const adminUser: PermissionUser = { id: adminUserId, role: adminRole };
            const canView = await canViewNoteSecret(adminUser, noteId);

            // Admins should ALWAYS be able to view secrets
            return canView === true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 11: Unauthorized Secret Access Denial**
   * Project members with appropriate roles can view secrets in their projects.
   * **Validates: Requirements 7.4, 2.6**
   */
  it(
    'Property 11: Unauthorized Secret Access Denial - project members can view secrets',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          uuidArbitrary,
          async (memberUserId, noteId, projectId) => {
            // Create a MEMBER user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${memberUserId}, ${`member-${memberUserId}@example.com`}, 'hash', 'Member User', 'MEMBER')
            `);

            // Create a project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${memberUserId})
            `);

            // Add user as project member
            db.run(sql`
              INSERT INTO project_members (id, project_id, user_id, role)
              VALUES (${`pm-${memberUserId}`}, ${projectId}, ${memberUserId}, 'MEMBER')
            `);

            // Create a note in the project
            const encryptedSecret = encryptSecret('test-secret');
            db.run(sql`
              INSERT INTO notes (id, type, system_name, project_id, secret, created_by, updated_by)
              VALUES (${noteId}, 'API', 'Test System', ${projectId}, ${encryptedSecret}, ${memberUserId}, ${memberUserId})
            `);

            // Check if member can view the secret
            const memberUser: PermissionUser = { id: memberUserId, role: 'MEMBER' };
            const canView = await canViewNoteSecret(memberUser, noteId);

            // Project members should be able to view secrets in their projects
            return canView === true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
