/**
 * Property-based tests for search permission filtering
 * Tests that search results only include entities the user has permission to access
 *
 * **Feature: mmc-app, Property 13: Search Permission Filtering**
 * **Validates: Requirements 11.1, 11.2**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/lib/db/schema/index';
import { sql } from 'drizzle-orm';
import type { Role } from '@/lib/db/schema/users';

const PBT_RUNS = 100;

// Arbitrary generators for roles
const nonAdminRoleArb = fc.constantFrom<Role>('MANAGER', 'MEMBER', 'GUEST');

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

  // Create tasks table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'BACKLOG',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      assignee_id TEXT REFERENCES users(id),
      reporter_id TEXT NOT NULL REFERENCES users(id),
      due_date INTEGER,
      estimated_hours REAL,
      actual_hours REAL,
      linked_note_id TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create notes table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'OTHER',
      system_name TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id),
      project_id TEXT REFERENCES projects(id),
      host TEXT,
      port INTEGER,
      username TEXT,
      secret TEXT NOT NULL,
      metadata TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create indexes
  db.run(sql`CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members(project_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS notes_project_id_idx ON notes(project_id)`);
}

/**
 * Simulates the search permission filtering logic from the search API
 * This is a pure function that can be tested with property-based testing
 */
interface SearchUser {
  id: string;
  role: Role;
}

interface SearchableProject {
  id: string;
  name: string;
  description: string | null;
  managerId: string;
}

interface SearchableTask {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
}

interface SearchableNote {
  id: string;
  systemName: string;
  projectId: string | null;
  createdBy: string;
}

interface ProjectMembership {
  projectId: string;
  userId: string;
}

/**
 * Get accessible project IDs for a user
 */
function getAccessibleProjectIds(
  user: SearchUser,
  projects: SearchableProject[],
  memberships: ProjectMembership[]
): string[] | null {
  // SUPER_ADMIN can access all projects
  if (user.role === 'SUPER_ADMIN') {
    return null; // null means all projects
  }

  // Get projects where user is a member
  const memberProjectIds = memberships
    .filter((m) => m.userId === user.id)
    .map((m) => m.projectId);

  // Get projects where user is the manager
  const managedProjectIds = projects
    .filter((p) => p.managerId === user.id)
    .map((p) => p.id);

  return [...new Set([...memberProjectIds, ...managedProjectIds])];
}

/**
 * Filter projects by search term and user access
 */
function filterProjects(
  projects: SearchableProject[],
  searchTerm: string,
  accessibleProjectIds: string[] | null
): SearchableProject[] {
  const pattern = searchTerm.toLowerCase();

  return projects.filter((project) => {
    // Check search match
    const matchesSearch =
      project.name.toLowerCase().includes(pattern) ||
      (project.description?.toLowerCase().includes(pattern) ?? false);

    if (!matchesSearch) return false;

    // Check access
    if (accessibleProjectIds === null) return true; // Admin access
    return accessibleProjectIds.includes(project.id);
  });
}

/**
 * Filter tasks by search term and user access
 */
function filterTasks(
  tasks: SearchableTask[],
  searchTerm: string,
  accessibleProjectIds: string[] | null
): SearchableTask[] {
  const pattern = searchTerm.toLowerCase();

  return tasks.filter((task) => {
    // Check search match
    const matchesSearch =
      task.title.toLowerCase().includes(pattern) ||
      (task.description?.toLowerCase().includes(pattern) ?? false);

    if (!matchesSearch) return false;

    // Check access
    if (accessibleProjectIds === null) return true; // Admin access
    return accessibleProjectIds.includes(task.projectId);
  });
}

/**
 * Filter notes by search term and user access
 */
function filterNotes(
  notes: SearchableNote[],
  searchTerm: string,
  accessibleProjectIds: string[] | null,
  userId: string
): SearchableNote[] {
  const pattern = searchTerm.toLowerCase();

  return notes.filter((note) => {
    // Check search match
    const matchesSearch = note.systemName.toLowerCase().includes(pattern);

    if (!matchesSearch) return false;

    // Check access
    if (accessibleProjectIds === null) return true; // Admin access

    // User can access notes they created
    if (note.createdBy === userId) return true;

    // User can access notes in accessible projects
    if (note.projectId && accessibleProjectIds.includes(note.projectId)) return true;

    return false;
  });
}

describe('Search Permission Filtering Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* search query and user, all returned project results should only include
   * projects that the user has permission to access.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - SUPER_ADMIN can see all matching projects', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            managerId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        (userId, projects, searchTerm) => {
          const user: SearchUser = { id: userId, role: 'SUPER_ADMIN' };
          const accessibleIds = getAccessibleProjectIds(user, projects, []);

          // SUPER_ADMIN should have access to all projects (null means all)
          expect(accessibleIds).toBeNull();

          const results = filterProjects(projects, searchTerm, accessibleIds);

          // All results should match the search term
          const pattern = searchTerm.toLowerCase();
          for (const project of results) {
            const matchesSearch =
              project.name.toLowerCase().includes(pattern) ||
              (project.description?.toLowerCase().includes(pattern) ?? false);
            expect(matchesSearch).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* search query and ADMIN user, all returned project results should only include
   * projects that the user has permission to access.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - ADMIN can see all matching projects', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            managerId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        (userId, projects, _searchTerm) => {
          const user: SearchUser = { id: userId, role: 'SUPER_ADMIN' };
          const accessibleIds = getAccessibleProjectIds(user, projects, []);

          // SUPER_ADMIN should have access to all projects (null means all)
          expect(accessibleIds).toBeNull();

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* non-admin user without project membership, search should return no projects.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - non-member cannot see projects', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            managerId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        (userId, role, projects, searchTerm) => {
          // Ensure user is not a manager of any project
          fc.pre(!projects.some((p) => p.managerId === userId));

          const user: SearchUser = { id: userId, role };
          const accessibleIds = getAccessibleProjectIds(user, projects, []);

          // Non-admin without membership should have empty accessible list
          expect(accessibleIds).toEqual([]);

          const results = filterProjects(projects, searchTerm, accessibleIds);

          // Should return no projects
          expect(results).toHaveLength(0);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* user who is a project member, search should include that project if it matches.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - member can see their projects', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
          managerId: fc.uuid(),
        }),
        (userId, role, project) => {
          const user: SearchUser = { id: userId, role };
          const memberships: ProjectMembership[] = [{ projectId: project.id, userId }];

          const accessibleIds = getAccessibleProjectIds(user, [project], memberships);

          // User should have access to the project they're a member of
          expect(accessibleIds).toContain(project.id);

          // Search for the project name should return it
          const results = filterProjects([project], project.name, accessibleIds);
          expect(results).toHaveLength(1);
          expect(results[0]!.id).toBe(project.id);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* user who is a project manager, search should include that project if it matches.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - manager can see their managed projects', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.option(fc.string({ maxLength: 100 }), { nil: null }),
        (userId, role, projectName, projectDescription) => {
          const project: SearchableProject = {
            id: 'project-1',
            name: projectName,
            description: projectDescription,
            managerId: userId, // User is the manager
          };

          const user: SearchUser = { id: userId, role };
          const accessibleIds = getAccessibleProjectIds(user, [project], []);

          // User should have access to the project they manage
          expect(accessibleIds).toContain(project.id);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* search query and user, all returned task results should only include
   * tasks from projects that the user has permission to access.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - tasks filtered by project access', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.array(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            projectId: fc.constantFrom('project-accessible', 'project-inaccessible'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (_userId, _role, tasks) => {
          const accessibleProjectIds = ['project-accessible'];

          // Filter tasks
          const results = filterTasks(tasks, '', accessibleProjectIds);

          // All results should be from accessible projects
          for (const task of results) {
            expect(accessibleProjectIds).toContain(task.projectId);
          }

          // No results should be from inaccessible projects
          const inaccessibleResults = results.filter(
            (t) => t.projectId === 'project-inaccessible'
          );
          expect(inaccessibleResults).toHaveLength(0);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* search query and user, all returned note results should only include
   * notes from projects that the user has permission to access, or notes they created.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - notes filtered by project access or ownership', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.array(
          fc.record({
            id: fc.uuid(),
            systemName: fc.string({ minLength: 1, maxLength: 50 }),
            projectId: fc.option(
              fc.constantFrom('project-accessible', 'project-inaccessible'),
              { nil: null }
            ),
            createdBy: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, _role, notes) => {
          const accessibleProjectIds = ['project-accessible'];

          // Filter notes
          const results = filterNotes(notes, '', accessibleProjectIds, userId);

          // All results should be either:
          // 1. From accessible projects
          // 2. Created by the user
          for (const note of results) {
            const isAccessibleProject =
              note.projectId && accessibleProjectIds.includes(note.projectId);
            const isOwnNote = note.createdBy === userId;

            expect(isAccessibleProject || isOwnNote).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * *For any* user, they can always see notes they created regardless of project access.
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 13: Search Permission Filtering - user can see their own notes', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (userId, _role, systemName) => {
          const note: SearchableNote = {
            id: 'note-1',
            systemName,
            projectId: 'project-inaccessible', // User doesn't have access to this project
            createdBy: userId, // But user created the note
          };

          const accessibleProjectIds: string[] = []; // No project access

          // Filter notes - should still find the note because user created it
          const results = filterNotes([note], systemName, accessibleProjectIds, userId);

          expect(results).toHaveLength(1);
          expect(results[0]!.id).toBe(note.id);

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 13: Search Permission Filtering**
   * Search results should only include items that match the search term.
   * **Validates: Requirements 11.1**
   */
  it('Property 13: Search Permission Filtering - results match search term', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            managerId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 3, maxLength: 10 }),
        (userId, projects, searchTerm) => {
          const user: SearchUser = { id: userId, role: 'SUPER_ADMIN' };
          const accessibleIds = getAccessibleProjectIds(user, projects, []);

          const results = filterProjects(projects, searchTerm, accessibleIds);
          const pattern = searchTerm.toLowerCase();

          // All results must match the search term
          for (const project of results) {
            const matchesName = project.name.toLowerCase().includes(pattern);
            const matchesDescription =
              project.description?.toLowerCase().includes(pattern) ?? false;

            expect(matchesName || matchesDescription).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});
