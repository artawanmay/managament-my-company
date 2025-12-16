/**
 * Property-based tests for permissions system
 * Tests role permission boundaries and project access control
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/lib/db/schema/index';
import { sql } from 'drizzle-orm';
import {
  hasPermission,
  hasEqualOrHigherRole,
  canManageUsers,
  canManageUser,
  isProjectMember,
  canAccessProject,
  setDatabase,
  resetDatabase,
  PERMISSION_MATRIX,
  roleValues,
  type Role,
  type PermissionAction,
  type PermissionUser,
} from '@/lib/auth/permissions';

const PBT_RUNS = 100;

// Arbitrary generators for roles
const roleArb = fc.constantFrom(...roleValues);

// All permission actions
const allPermissionActions: PermissionAction[] = [
  'manage_all_users',
  'manage_users',
  'manage_clients',
  'manage_projects',
  'manage_assigned_projects',
  'create_tasks',
  'edit_tasks',
  'view_secrets',
  'read_only',
];

const permissionActionArb = fc.constantFrom(...allPermissionActions);

// Generate a PermissionUser
const permissionUserArb = fc.record({
  id: fc.uuid(),
  role: roleArb,
});

describe('Role Permission Properties', () => {
  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * *For any* user with a given role and any resource action, the permission check
   * should return true only if the role is authorized for that action according to
   * the role hierarchy (SUPER_ADMIN > ADMIN > MANAGER > MEMBER > GUEST).
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  it('Property 5: Role Permission Boundaries - hasPermission matches permission matrix', () => {
    fc.assert(
      fc.property(roleArb, permissionActionArb, (role, action) => {
        const result = hasPermission(role, action);
        const expected = PERMISSION_MATRIX[role].has(action);
        return result === expected;
      }),
      { numRuns: PBT_RUNS }
    );
  });


  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * Role hierarchy is transitive: if A >= B and B >= C, then A >= C
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  it('Property 5: Role Permission Boundaries - role hierarchy is transitive', () => {
    fc.assert(
      fc.property(roleArb, roleArb, roleArb, (roleA, roleB, roleC) => {
        const aGteB = hasEqualOrHigherRole(roleA, roleB);
        const bGteC = hasEqualOrHigherRole(roleB, roleC);
        const aGteC = hasEqualOrHigherRole(roleA, roleC);

        // If A >= B and B >= C, then A >= C
        if (aGteB && bGteC) {
          return aGteC === true;
        }
        return true; // No constraint if premise is false
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * Role hierarchy is reflexive: every role is >= itself
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  it('Property 5: Role Permission Boundaries - role hierarchy is reflexive', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        return hasEqualOrHigherRole(role, role) === true;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * SUPER_ADMIN has the highest role - it is >= all other roles
   * **Validates: Requirements 2.2**
   */
  it('Property 5: Role Permission Boundaries - SUPER_ADMIN is highest role', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        return hasEqualOrHigherRole('SUPER_ADMIN', role) === true;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * GUEST has the lowest role - all roles are >= GUEST
   * **Validates: Requirements 2.6**
   */
  it('Property 5: Role Permission Boundaries - GUEST is lowest role', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        return hasEqualOrHigherRole(role, 'GUEST') === true;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * SUPER_ADMIN can manage any user
   * **Validates: Requirements 2.2**
   */
  it('Property 5: Role Permission Boundaries - SUPER_ADMIN can manage any user', () => {
    fc.assert(
      fc.property(fc.uuid(), roleArb, (userId, targetRole) => {
        const superAdmin: PermissionUser = { id: userId, role: 'SUPER_ADMIN' };
        return canManageUser(superAdmin, targetRole) === true;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * ADMIN can manage any user except SUPER_ADMIN
   * **Validates: Requirements 2.3**
   */
  it('Property 5: Role Permission Boundaries - ADMIN cannot manage SUPER_ADMIN', () => {
    fc.assert(
      fc.property(fc.uuid(), (userId) => {
        const admin: PermissionUser = { id: userId, role: 'ADMIN' };
        return canManageUser(admin, 'SUPER_ADMIN') === false;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * ADMIN can manage users with roles below SUPER_ADMIN
   * **Validates: Requirements 2.3**
   */
  it('Property 5: Role Permission Boundaries - ADMIN can manage non-SUPER_ADMIN users', () => {
    const nonSuperAdminRoles: Role[] = ['ADMIN', 'MANAGER', 'MEMBER', 'GUEST'];
    const nonSuperAdminRoleArb = fc.constantFrom(...nonSuperAdminRoles);

    fc.assert(
      fc.property(fc.uuid(), nonSuperAdminRoleArb, (userId, targetRole) => {
        const admin: PermissionUser = { id: userId, role: 'ADMIN' };
        return canManageUser(admin, targetRole) === true;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * Roles below ADMIN cannot manage any users
   * **Validates: Requirements 2.4, 2.5, 2.6**
   */
  it('Property 5: Role Permission Boundaries - lower roles cannot manage users', () => {
    const lowerRoles: Role[] = ['MANAGER', 'MEMBER', 'GUEST'];
    const lowerRoleArb = fc.constantFrom(...lowerRoles);

    fc.assert(
      fc.property(fc.uuid(), lowerRoleArb, roleArb, (userId, userRole, targetRole) => {
        const user: PermissionUser = { id: userId, role: userRole };
        return canManageUser(user, targetRole) === false;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * canManageUsers returns true only for SUPER_ADMIN and ADMIN
   * **Validates: Requirements 2.2, 2.3**
   */
  it('Property 5: Role Permission Boundaries - only SUPER_ADMIN and ADMIN can manage users', () => {
    fc.assert(
      fc.property(permissionUserArb, (user) => {
        const canManage = canManageUsers(user);
        const shouldBeAbleToManage = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        return canManage === shouldBeAbleToManage;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * GUEST role only has read_only permission
   * **Validates: Requirements 2.6**
   */
  it('Property 5: Role Permission Boundaries - GUEST only has read_only permission', () => {
    fc.assert(
      fc.property(permissionActionArb, (action) => {
        const hasIt = hasPermission('GUEST', action);
        if (action === 'read_only') {
          return hasIt === true;
        }
        return hasIt === false;
      }),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 5: Role Permission Boundaries**
   * Higher roles have superset of permissions of lower roles (except read_only which is GUEST-specific)
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  it('Property 5: Role Permission Boundaries - permission inheritance (excluding read_only)', () => {
    // Permissions that should be inherited (not role-specific like read_only)
    const inheritableActions: PermissionAction[] = [
      'manage_all_users',
      'manage_users',
      'manage_clients',
      'manage_projects',
      'manage_assigned_projects',
      'create_tasks',
      'edit_tasks',
      'view_secrets',
    ];
    const inheritableActionArb = fc.constantFrom(...inheritableActions);

    fc.assert(
      fc.property(roleArb, roleArb, inheritableActionArb, (roleA, roleB, action) => {
        // If roleA >= roleB and roleB has the permission, then roleA should have it too
        if (hasEqualOrHigherRole(roleA, roleB) && hasPermission(roleB, action)) {
          return hasPermission(roleA, action) === true;
        }
        return true; // No constraint if premise is false
      }),
      { numRuns: PBT_RUNS }
    );
  });
});


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
}

describe('Project Access Control Properties', () => {
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
   * **Feature: mmc-app, Property 6: Project Access Control**
   * *For any* user and project, the user should only have access if they are a
   * SUPER_ADMIN, ADMIN, or a member of that project.
   * **Validates: Requirements 4.2, 4.4, 4.5**
   */
  it('Property 6: Project Access Control - SUPER_ADMIN can access any project', async () => {
    // Create test data
    const clientId = 'test-client-1';
    const projectId = 'test-project-1';
    const managerId = 'test-manager-1';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager@test.com', 'hash', 'Manager', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project', ${managerId})
    `);

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const superAdmin: PermissionUser = { id: userId, role: 'SUPER_ADMIN' };
        const canAccess = await canAccessProject(superAdmin, projectId);
        return canAccess === true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: mmc-app, Property 6: Project Access Control**
   * ADMIN can access any project
   * **Validates: Requirements 4.2, 4.4, 4.5**
   */
  it('Property 6: Project Access Control - ADMIN can access any project', async () => {
    // Create test data
    const clientId = 'test-client-2';
    const projectId = 'test-project-2';
    const managerId = 'test-manager-2';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client 2')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager2@test.com', 'hash', 'Manager 2', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project 2', ${managerId})
    `);

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const admin: PermissionUser = { id: userId, role: 'ADMIN' };
        const canAccess = await canAccessProject(admin, projectId);
        return canAccess === true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: mmc-app, Property 6: Project Access Control**
   * Non-admin users without membership cannot access projects
   * **Validates: Requirements 4.2, 4.4, 4.5**
   */
  it('Property 6: Project Access Control - non-member cannot access project', async () => {
    // Create test data
    const clientId = 'test-client-3';
    const projectId = 'test-project-3';
    const managerId = 'test-manager-3';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client 3')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager3@test.com', 'hash', 'Manager 3', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project 3', ${managerId})
    `);

    const nonAdminRoles: Role[] = ['MANAGER', 'MEMBER', 'GUEST'];
    const nonAdminRoleArb = fc.constantFrom(...nonAdminRoles);

    await fc.assert(
      fc.asyncProperty(fc.uuid(), nonAdminRoleArb, async (userId, role) => {
        // Ensure user is not the manager
        fc.pre(userId !== managerId);

        const user: PermissionUser = { id: userId, role };
        const canAccess = await canAccessProject(user, projectId);
        return canAccess === false;
      }),
      { numRuns: 20 }
    );
  });


  /**
   * **Feature: mmc-app, Property 6: Project Access Control**
   * Project members can access their assigned projects
   * **Validates: Requirements 4.2, 4.4, 4.5**
   */
  it('Property 6: Project Access Control - project member can access project', async () => {
    // Create test data
    const clientId = 'test-client-4';
    const projectId = 'test-project-4';
    const managerId = 'test-manager-4';
    const memberId = 'test-member-4';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client 4')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager4@test.com', 'hash', 'Manager 4', 'MANAGER')
    `);

    // Insert test member user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${memberId}, 'member4@test.com', 'hash', 'Member 4', 'MEMBER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project 4', ${managerId})
    `);

    // Add member to project
    testDb.db.run(sql`
      INSERT INTO project_members (id, project_id, user_id, role)
      VALUES ('pm-1', ${projectId}, ${memberId}, 'MEMBER')
    `);

    const memberRoles: Role[] = ['MANAGER', 'MEMBER', 'GUEST'];
    const memberRoleArb = fc.constantFrom(...memberRoles);

    await fc.assert(
      fc.asyncProperty(memberRoleArb, async (role) => {
        const user: PermissionUser = { id: memberId, role };
        const canAccess = await canAccessProject(user, projectId);
        return canAccess === true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: mmc-app, Property 6: Project Access Control**
   * Project manager can access their managed projects
   * **Validates: Requirements 4.2, 4.4, 4.5**
   */
  it('Property 6: Project Access Control - project manager can access project', async () => {
    // Create test data
    const clientId = 'test-client-5';
    const projectId = 'test-project-5';
    const managerId = 'test-manager-5';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client 5')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager5@test.com', 'hash', 'Manager 5', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project 5', ${managerId})
    `);

    const managerRoles: Role[] = ['MANAGER', 'MEMBER', 'GUEST'];
    const managerRoleArb = fc.constantFrom(...managerRoles);

    await fc.assert(
      fc.asyncProperty(managerRoleArb, async (role) => {
        const user: PermissionUser = { id: managerId, role };
        const canAccess = await canAccessProject(user, projectId);
        return canAccess === true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: mmc-app, Property 6: Project Access Control**
   * isProjectMember returns true only for actual members
   * **Validates: Requirements 4.4, 4.5**
   */
  it('Property 6: Project Access Control - isProjectMember accuracy', async () => {
    // Create test data
    const clientId = 'test-client-6';
    const projectId = 'test-project-6';
    const managerId = 'test-manager-6';
    const memberId = 'test-member-6';
    const nonMemberId = 'test-non-member-6';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client 6')
    `);

    // Insert test users
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager6@test.com', 'hash', 'Manager 6', 'MANAGER')
    `);
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${memberId}, 'member6@test.com', 'hash', 'Member 6', 'MEMBER')
    `);
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${nonMemberId}, 'nonmember6@test.com', 'hash', 'Non Member 6', 'MEMBER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project 6', ${managerId})
    `);

    // Add member to project
    testDb.db.run(sql`
      INSERT INTO project_members (id, project_id, user_id, role)
      VALUES ('pm-6', ${projectId}, ${memberId}, 'MEMBER')
    `);

    // Test member is recognized
    const isMember = await isProjectMember(memberId, projectId);
    expect(isMember).toBe(true);

    // Test non-member is not recognized
    const isNotMember = await isProjectMember(nonMemberId, projectId);
    expect(isNotMember).toBe(false);
  });
});
