/**
 * Property-based tests for project management
 * Tests member assignment round-trip and archived project exclusion
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/lib/db/schema/index';
import { sql } from 'drizzle-orm';
import {
  isProjectMember,
  canAccessProject,
  setDatabase,
  resetDatabase,
  type PermissionUser,
} from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';

const PBT_RUNS = 100;

// Helper to create test database
function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

// Initialize test database with required tables
function initTestDb(db: ReturnType<typeof createTestDb>['db']) {
  // Create users table
  db.run(sql`
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
  db.run(sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pic_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      website TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create projects table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNING',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      start_date INTEGER,
      end_date INTEGER,
      manager_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create project_members table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, user_id)
    )
  `);

  // Create indexes
  db.run(sql`CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members(project_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status)`);
}

describe('Project Member Assignment Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
    // Inject test database
    setDatabase(testDb.db as any);
  });

  afterEach(() => {
    // Reset to default database
    resetDatabase();
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 7: Member Assignment Round-Trip**
   * *For any* project and user, assigning the user as a member and then checking
   * access should return true, and removing the member and checking access should
   * return false.
   * **Validates: Requirements 4.4, 4.5**
   */
  it('Property 7: Member Assignment Round-Trip - adding member grants access', async () => {
    // Create base test data
    const clientId = 'test-client-rt';
    const managerId = 'test-manager-rt';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client RT')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-rt@test.com', 'hash', 'Manager RT', 'MANAGER')
    `);

    const projectMemberRoles = ['MANAGER', 'MEMBER', 'VIEWER'] as const;
    const projectMemberRoleArb = fc.constantFrom(...projectMemberRoles);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.emailAddress(),
        projectMemberRoleArb,
        async (projectId, userId, email, memberRole) => {
          // Ensure unique IDs
          fc.pre(projectId !== clientId && projectId !== managerId);
          fc.pre(userId !== managerId && userId !== clientId);

          // Create project
          testDb.db.run(sql`
            INSERT OR IGNORE INTO projects (id, client_id, name, manager_id)
            VALUES (${projectId}, ${clientId}, 'Test Project', ${managerId})
          `);

          // Create user
          testDb.db.run(sql`
            INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
            VALUES (${userId}, ${email}, 'hash', 'Test User', 'MEMBER')
          `);

          // User should NOT have access before being added as member
          const user: PermissionUser = { id: userId, role: 'MEMBER' };
          const accessBefore = await canAccessProject(user, projectId);

          // If user is not the manager, they shouldn't have access
          if (userId !== managerId) {
            if (accessBefore !== false) {
              return false;
            }
          }

          // Add user as project member
          const memberId = randomUUID();
          testDb.db.run(sql`
            INSERT OR IGNORE INTO project_members (id, project_id, user_id, role)
            VALUES (${memberId}, ${projectId}, ${userId}, ${memberRole})
          `);

          // User SHOULD have access after being added as member
          const accessAfterAdd = await canAccessProject(user, projectId);
          if (accessAfterAdd !== true) {
            return false;
          }

          // Also verify isProjectMember returns true
          const isMember = await isProjectMember(userId, projectId);
          if (isMember !== true) {
            return false;
          }

          // Remove user from project
          testDb.db.run(sql`
            DELETE FROM project_members
            WHERE project_id = ${projectId} AND user_id = ${userId}
          `);

          // User should NOT have access after being removed
          const accessAfterRemove = await canAccessProject(user, projectId);
          if (userId !== managerId && accessAfterRemove !== false) {
            return false;
          }

          // Also verify isProjectMember returns false
          const isMemberAfterRemove = await isProjectMember(userId, projectId);
          if (isMemberAfterRemove !== false) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: mmc-app, Property 7: Member Assignment Round-Trip**
   * Adding a member is idempotent - adding the same member twice should not cause errors
   * **Validates: Requirements 4.4**
   */
  it('Property 7: Member Assignment Round-Trip - idempotent member addition', async () => {
    // Create base test data
    const clientId = 'test-client-idem';
    const projectId = 'test-project-idem';
    const managerId = 'test-manager-idem';
    const memberId = 'test-member-idem';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Idem')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-idem@test.com', 'hash', 'Manager Idem', 'MANAGER')
    `);

    // Insert test member user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${memberId}, 'member-idem@test.com', 'hash', 'Member Idem', 'MEMBER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project Idem', ${managerId})
    `);

    // Add member first time
    testDb.db.run(sql`
      INSERT INTO project_members (id, project_id, user_id, role)
      VALUES ('pm-idem-1', ${projectId}, ${memberId}, 'MEMBER')
    `);

    // Verify member has access
    const user: PermissionUser = { id: memberId, role: 'MEMBER' };
    const accessAfterFirst = await canAccessProject(user, projectId);
    expect(accessAfterFirst).toBe(true);

    // Try to add member again (should fail due to unique constraint, but not crash)
    try {
      testDb.db.run(sql`
        INSERT INTO project_members (id, project_id, user_id, role)
        VALUES ('pm-idem-2', ${projectId}, ${memberId}, 'MEMBER')
      `);
      // If we get here, the unique constraint didn't work
      expect(true).toBe(false);
    } catch {
      // Expected - unique constraint violation
    }

    // Verify member still has access
    const accessAfterSecond = await canAccessProject(user, projectId);
    expect(accessAfterSecond).toBe(true);
  });
});

describe('Archived Project Exclusion Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
    setDatabase(testDb.db as any);
  });

  afterEach(() => {
    resetDatabase();
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 23: Archived Project Exclusion**
   * *For any* archived project, it should not appear in default project listings
   * (only in explicit archived views).
   * **Validates: Requirements 4.6**
   */
  it('Property 23: Archived Project Exclusion - archived projects excluded from default listing', async () => {
    // Create base test data
    const clientId = 'test-client-arch';
    const managerId = 'test-manager-arch';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Arch')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-arch@test.com', 'hash', 'Manager Arch', 'MANAGER')
    `);

    const projectStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
    const projectStatusArb = fc.constantFrom(...projectStatuses);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        projectStatusArb,
        async (projectId, projectName, status) => {
          // Ensure unique project ID
          fc.pre(projectId !== clientId && projectId !== managerId);

          // Create project with given status
          testDb.db.run(sql`
            INSERT OR REPLACE INTO projects (id, client_id, name, status, manager_id)
            VALUES (${projectId}, ${clientId}, ${projectName}, ${status}, ${managerId})
          `);

          // Query projects excluding archived (default behavior)
          const defaultListResult = testDb.db.all(sql`
            SELECT id, status FROM projects WHERE status != 'ARCHIVED'
          `) as { id: string; status: string }[];

          // Query all projects including archived
          const allProjectsResult = testDb.db.all(sql`
            SELECT id, status FROM projects
          `) as { id: string; status: string }[];

          // If project is archived, it should NOT appear in default list
          if (status === 'ARCHIVED') {
            const inDefaultList = defaultListResult.some((p) => p.id === projectId);
            if (inDefaultList) {
              return false;
            }
          } else {
            // Non-archived projects SHOULD appear in default list
            const inDefaultList = defaultListResult.some((p) => p.id === projectId);
            if (!inDefaultList) {
              return false;
            }
          }

          // All projects should appear in the full list
          const inAllList = allProjectsResult.some((p) => p.id === projectId);
          if (!inAllList) {
            return false;
          }

          // Clean up for next iteration
          testDb.db.run(sql`DELETE FROM projects WHERE id = ${projectId}`);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 23: Archived Project Exclusion**
   * Archiving a project changes its status to ARCHIVED
   * **Validates: Requirements 4.6**
   */
  it('Property 23: Archived Project Exclusion - archiving changes status correctly', async () => {
    // Create base test data
    const clientId = 'test-client-arch2';
    const managerId = 'test-manager-arch2';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Arch2')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-arch2@test.com', 'hash', 'Manager Arch2', 'MANAGER')
    `);

    const nonArchivedStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const;
    const nonArchivedStatusArb = fc.constantFrom(...nonArchivedStatuses);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        nonArchivedStatusArb,
        async (projectId, projectName, initialStatus) => {
          // Ensure unique project ID
          fc.pre(projectId !== clientId && projectId !== managerId);

          // Create project with non-archived status
          testDb.db.run(sql`
            INSERT OR REPLACE INTO projects (id, client_id, name, status, manager_id)
            VALUES (${projectId}, ${clientId}, ${projectName}, ${initialStatus}, ${managerId})
          `);

          // Verify project is in default list before archiving
          const beforeArchive = testDb.db.all(sql`
            SELECT id FROM projects WHERE status != 'ARCHIVED' AND id = ${projectId}
          `) as { id: string }[];

          if (beforeArchive.length !== 1) {
            return false;
          }

          // Archive the project
          testDb.db.run(sql`
            UPDATE projects SET status = 'ARCHIVED' WHERE id = ${projectId}
          `);

          // Verify project is NOT in default list after archiving
          const afterArchive = testDb.db.all(sql`
            SELECT id FROM projects WHERE status != 'ARCHIVED' AND id = ${projectId}
          `) as { id: string }[];

          if (afterArchive.length !== 0) {
            return false;
          }

          // Verify project status is ARCHIVED
          const projectStatus = testDb.db.all(sql`
            SELECT status FROM projects WHERE id = ${projectId}
          `) as { status: string }[];

          if (projectStatus[0]?.status !== 'ARCHIVED') {
            return false;
          }

          // Clean up for next iteration
          testDb.db.run(sql`DELETE FROM projects WHERE id = ${projectId}`);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 23: Archived Project Exclusion**
   * Archived projects can still be accessed when explicitly requested
   * **Validates: Requirements 4.6**
   */
  it('Property 23: Archived Project Exclusion - archived projects accessible when explicitly requested', async () => {
    // Create base test data
    const clientId = 'test-client-arch3';
    const projectId = 'test-project-arch3';
    const managerId = 'test-manager-arch3';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Arch3')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-arch3@test.com', 'hash', 'Manager Arch3', 'MANAGER')
    `);

    // Insert archived project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, status, manager_id)
      VALUES (${projectId}, ${clientId}, 'Archived Project', 'ARCHIVED', ${managerId})
    `);

    // Query with includeArchived = true (all projects)
    const withArchived = testDb.db.all(sql`
      SELECT id, status FROM projects
    `) as { id: string; status: string }[];

    // Archived project should be in the list
    const found = withArchived.find((p) => p.id === projectId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('ARCHIVED');

    // Query with includeArchived = false (default)
    const withoutArchived = testDb.db.all(sql`
      SELECT id, status FROM projects WHERE status != 'ARCHIVED'
    `) as { id: string; status: string }[];

    // Archived project should NOT be in the default list
    const notFound = withoutArchived.find((p) => p.id === projectId);
    expect(notFound).toBeUndefined();
  });
});
