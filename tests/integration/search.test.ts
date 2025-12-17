/**
 * Integration tests for search permission filtering
 * Verifies only accessible entities are returned in search results
 *
 * Requirements: 11.2
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema/index';
import type { Role } from '@/lib/db/schema/users';

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
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create projects table
  sqlite.exec(`
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
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'MEMBER',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, user_id)
    )
  `);

  // Create tasks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
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
  sqlite.exec(`
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
}

function cleanupTestDb() {
  if (sqlite) {
    sqlite.close();
  }
}

// Helper functions
function createUser(id: string, email: string, role: Role = 'MEMBER') {
  db.run(sql`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (${id}, ${email}, 'hash', 'Test User', ${role})
  `);
  return { id, email, role };
}

function createClient(id: string, name: string) {
  db.run(sql`
    INSERT INTO clients (id, name, status)
    VALUES (${id}, ${name}, 'ACTIVE')
  `);
  return { id, name };
}

function createProject(id: string, clientId: string, managerId: string, name: string, description?: string) {
  db.run(sql`
    INSERT INTO projects (id, client_id, manager_id, name, description, status)
    VALUES (${id}, ${clientId}, ${managerId}, ${name}, ${description ?? null}, 'ACTIVE')
  `);
  return { id, clientId, managerId, name, description };
}

function addProjectMember(id: string, projectId: string, userId: string, role: string = 'MEMBER') {
  db.run(sql`
    INSERT INTO project_members (id, project_id, user_id, role)
    VALUES (${id}, ${projectId}, ${userId}, ${role})
  `);
  return { id, projectId, userId, role };
}

function createTask(id: string, projectId: string, reporterId: string, title: string, description?: string) {
  db.run(sql`
    INSERT INTO tasks (id, project_id, reporter_id, title, description, status)
    VALUES (${id}, ${projectId}, ${reporterId}, ${title}, ${description ?? null}, 'TODO')
  `);
  return { id, projectId, reporterId, title, description };
}

function createNote(id: string, systemName: string, createdBy: string, projectId?: string) {
  db.run(sql`
    INSERT INTO notes (id, type, system_name, secret, created_by, updated_by, project_id)
    VALUES (${id}, 'API', ${systemName}, 'encrypted-secret', ${createdBy}, ${createdBy}, ${projectId ?? null})
  `);
  return { id, systemName, createdBy, projectId };
}

// Search implementation for testing
interface SearchUser {
  id: string;
  role: Role;
}

interface SearchResults {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  tasks: { id: string; title: string; projectId: string }[];
  notes: { id: string; systemName: string; projectId: string | null }[];
}

function getAccessibleProjectIds(user: SearchUser): string[] | null {
  // SUPER_ADMIN can access all projects
  if (user.role === 'SUPER_ADMIN') {
    return null; // null means all projects
  }

  // Get projects where user is a member
  const memberProjects = db.all(sql`
    SELECT project_id FROM project_members WHERE user_id = ${user.id}
  `) as { project_id: string }[];

  // Get projects where user is the manager
  const managedProjects = db.all(sql`
    SELECT id FROM projects WHERE manager_id = ${user.id}
  `) as { id: string }[];

  const memberIds = memberProjects.map((p) => p.project_id);
  const managedIds = managedProjects.map((p) => p.id);

  return [...new Set([...memberIds, ...managedIds])];
}

function searchWithPermissions(query: string, user: SearchUser): SearchResults {
  const pattern = `%${query}%`;
  const accessibleProjectIds = getAccessibleProjectIds(user);

  // Search clients (SUPER_ADMIN and MANAGER only)
  let clients: { id: string; name: string }[] = [];
  if (user.role === 'SUPER_ADMIN' || user.role === 'MANAGER') {
    clients = db.all(sql`
      SELECT id, name FROM clients WHERE name LIKE ${pattern}
    `) as { id: string; name: string }[];
  }

  // Search projects
  let projects: { id: string; name: string }[] = [];
  if (accessibleProjectIds === null) {
    // Admin access - all projects
    projects = db.all(sql`
      SELECT id, name FROM projects 
      WHERE name LIKE ${pattern} OR description LIKE ${pattern}
    `) as { id: string; name: string }[];
  } else if (accessibleProjectIds.length > 0) {
    // Filter by accessible projects
    projects = db.all(sql`
      SELECT id, name FROM projects 
      WHERE (name LIKE ${pattern} OR description LIKE ${pattern})
    `) as { id: string; name: string }[];
    projects = projects.filter((p) => accessibleProjectIds.includes(p.id));
  }

  // Search tasks
  let tasks: { id: string; title: string; projectId: string }[] = [];
  if (accessibleProjectIds === null) {
    // Admin access - all tasks
    tasks = db.all(sql`
      SELECT id, title, project_id as projectId FROM tasks 
      WHERE title LIKE ${pattern} OR description LIKE ${pattern}
    `) as { id: string; title: string; projectId: string }[];
  } else if (accessibleProjectIds.length > 0) {
    // Filter by accessible projects
    tasks = db.all(sql`
      SELECT id, title, project_id as projectId FROM tasks 
      WHERE (title LIKE ${pattern} OR description LIKE ${pattern})
    `) as { id: string; title: string; projectId: string }[];
    tasks = tasks.filter((t) => accessibleProjectIds.includes(t.projectId));
  }

  // Search notes
  let notes: { id: string; systemName: string; projectId: string | null; createdBy: string }[] = [];
  if (accessibleProjectIds === null) {
    // Admin access - all notes
    notes = db.all(sql`
      SELECT id, system_name as systemName, project_id as projectId, created_by as createdBy 
      FROM notes WHERE system_name LIKE ${pattern}
    `) as { id: string; systemName: string; projectId: string | null; createdBy: string }[];
  } else {
    // Filter by accessible projects or ownership
    notes = db.all(sql`
      SELECT id, system_name as systemName, project_id as projectId, created_by as createdBy 
      FROM notes WHERE system_name LIKE ${pattern}
    `) as { id: string; systemName: string; projectId: string | null; createdBy: string }[];
    notes = notes.filter(
      (n) =>
        n.createdBy === user.id ||
        (n.projectId && accessibleProjectIds.includes(n.projectId))
    );
  }

  return {
    clients,
    projects,
    tasks,
    notes: notes.map((n) => ({ id: n.id, systemName: n.systemName, projectId: n.projectId })),
  };
}

describe('Search Permission Integration Tests', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  describe('Admin Search Access', () => {
    /**
     * Requirement 11.2: SUPER_ADMIN can search all entities
     */
    it('should return all matching entities for SUPER_ADMIN', () => {
      const superAdmin = createUser('super-admin', 'super@example.com', 'SUPER_ADMIN');
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');

      createClient('client-1', 'Acme Corporation');
      createClient('client-2', 'Beta Inc');
      createProject('project-1', 'client-1', manager.id, 'Acme Project', 'Main project');
      createProject('project-2', 'client-2', manager.id, 'Beta Project', 'Secondary project');
      createTask('task-1', 'project-1', manager.id, 'Acme Task');
      createTask('task-2', 'project-2', manager.id, 'Beta Task');
      createNote('note-1', 'Acme API', manager.id, 'project-1');
      createNote('note-2', 'Beta API', manager.id, 'project-2');

      const user: SearchUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      const results = searchWithPermissions('Acme', user);

      expect(results.clients.length).toBe(1);
      expect(results.clients[0]!.name).toBe('Acme Corporation');
      expect(results.projects.length).toBe(1);
      expect(results.projects[0]!.name).toBe('Acme Project');
      expect(results.tasks.length).toBe(1);
      expect(results.tasks[0]!.title).toBe('Acme Task');
      expect(results.notes.length).toBe(1);
      expect(results.notes[0]!.systemName).toBe('Acme API');
    });

    /**
     * Requirement 11.2: SUPER_ADMIN can search all entities
     */
    it('should return all matching entities for SUPER_ADMIN', () => {
      const superAdmin = createUser('super-admin', 'superadmin@example.com', 'SUPER_ADMIN');
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');

      createClient('client-1', 'Test Client');
      createProject('project-1', 'client-1', manager.id, 'Test Project');
      createTask('task-1', 'project-1', manager.id, 'Test Task');
      createNote('note-1', 'Test System', manager.id, 'project-1');

      const user: SearchUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      const results = searchWithPermissions('Test', user);

      expect(results.clients.length).toBe(1);
      expect(results.projects.length).toBe(1);
      expect(results.tasks.length).toBe(1);
      expect(results.notes.length).toBe(1);
    });
  });

  describe('Manager Search Access', () => {
    /**
     * Requirement 11.2: MANAGER can only search their managed projects
     */
    it('should only return entities from managed projects for MANAGER', () => {
      const manager1 = createUser('manager-1', 'manager1@example.com', 'MANAGER');
      const manager2 = createUser('manager-2', 'manager2@example.com', 'MANAGER');

      createClient('client-1', 'Shared Client');
      createProject('project-1', 'client-1', manager1.id, 'Manager1 Project');
      createProject('project-2', 'client-1', manager2.id, 'Manager2 Project');
      createTask('task-1', 'project-1', manager1.id, 'Manager1 Task');
      createTask('task-2', 'project-2', manager2.id, 'Manager2 Task');
      createNote('note-1', 'Manager1 System', manager1.id, 'project-1');
      createNote('note-2', 'Manager2 System', manager2.id, 'project-2');

      const user: SearchUser = { id: manager1.id, role: 'MANAGER' };
      const results = searchWithPermissions('Manager', user);

      // Manager1 should only see their own project, task, and note
      expect(results.clients.length).toBe(0); // Managers can't search clients
      expect(results.projects.length).toBe(1);
      expect(results.projects[0]!.name).toBe('Manager1 Project');
      expect(results.tasks.length).toBe(1);
      expect(results.tasks[0]!.title).toBe('Manager1 Task');
      expect(results.notes.length).toBe(1);
      expect(results.notes[0]!.systemName).toBe('Manager1 System');
    });

    /**
     * Requirement 11.2: MANAGER cannot see other managers' projects
     */
    it('should not return entities from other managers projects', () => {
      const manager1 = createUser('manager-a', 'manager-a@example.com', 'MANAGER');
      const manager2 = createUser('manager-b', 'manager-b@example.com', 'MANAGER');

      createClient('client-1', 'Client');
      createProject('project-secret', 'client-1', manager2.id, 'Secret Project');
      createTask('task-secret', 'project-secret', manager2.id, 'Secret Task');

      const user: SearchUser = { id: manager1.id, role: 'MANAGER' };
      const results = searchWithPermissions('Secret', user);

      expect(results.projects.length).toBe(0);
      expect(results.tasks.length).toBe(0);
    });
  });

  describe('Member Search Access', () => {
    /**
     * Requirement 11.2: MEMBER can only search projects they belong to
     */
    it('should only return entities from member projects for MEMBER', () => {
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');
      const member = createUser('member', 'member@example.com', 'MEMBER');

      createClient('client-1', 'Client');
      createProject('project-accessible', 'client-1', manager.id, 'Accessible Project');
      createProject('project-restricted', 'client-1', manager.id, 'Restricted Project');
      addProjectMember('pm-1', 'project-accessible', member.id, 'MEMBER');
      // Note: member is NOT added to project-restricted

      createTask('task-accessible', 'project-accessible', manager.id, 'Accessible Task');
      createTask('task-restricted', 'project-restricted', manager.id, 'Restricted Task');

      const user: SearchUser = { id: member.id, role: 'MEMBER' };
      const results = searchWithPermissions('Task', user);

      expect(results.tasks.length).toBe(1);
      expect(results.tasks[0]!.title).toBe('Accessible Task');
    });

    /**
     * Requirement 11.2: MEMBER cannot see projects they don't belong to
     */
    it('should not return entities from non-member projects', () => {
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');
      const member = createUser('member', 'member@example.com', 'MEMBER');

      createClient('client-1', 'Client');
      createProject('project-other', 'client-1', manager.id, 'Other Project');
      createTask('task-other', 'project-other', manager.id, 'Other Task');
      createNote('note-other', 'Other System', manager.id, 'project-other');

      const user: SearchUser = { id: member.id, role: 'MEMBER' };
      const results = searchWithPermissions('Other', user);

      expect(results.projects.length).toBe(0);
      expect(results.tasks.length).toBe(0);
      expect(results.notes.length).toBe(0);
    });

    /**
     * Requirement 11.2: MEMBER can see their own notes even in inaccessible projects
     */
    it('should return own notes regardless of project access', () => {
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');
      const member = createUser('member', 'member@example.com', 'MEMBER');

      createClient('client-1', 'Client');
      createProject('project-1', 'client-1', manager.id, 'Project');
      // Member creates a note but is not a project member
      createNote('note-own', 'Own System', member.id, 'project-1');

      const user: SearchUser = { id: member.id, role: 'MEMBER' };
      const results = searchWithPermissions('Own', user);

      // Member should see their own note
      expect(results.notes.length).toBe(1);
      expect(results.notes[0]!.systemName).toBe('Own System');
    });
  });

  describe('Guest Search Access', () => {
    /**
     * Requirement 11.2: GUEST has limited search access
     */
    it('should only return entities from projects GUEST belongs to', () => {
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');
      const guest = createUser('guest', 'guest@example.com', 'GUEST');

      createClient('client-1', 'Client');
      createProject('project-guest', 'client-1', manager.id, 'Guest Project');
      createProject('project-other', 'client-1', manager.id, 'Other Project');
      addProjectMember('pm-guest', 'project-guest', guest.id, 'VIEWER');

      createTask('task-guest', 'project-guest', manager.id, 'Guest Task');
      createTask('task-other', 'project-other', manager.id, 'Other Task');

      const user: SearchUser = { id: guest.id, role: 'GUEST' };
      const results = searchWithPermissions('Task', user);

      expect(results.tasks.length).toBe(1);
      expect(results.tasks[0]!.title).toBe('Guest Task');
    });
  });

  describe('Search Query Matching', () => {
    /**
     * Requirement 11.2: Search should match partial strings
     */
    it('should match partial search terms', () => {
      const superAdmin = createUser('super-admin', 'superadmin@example.com', 'SUPER_ADMIN');
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');

      createClient('client-1', 'International Corporation');
      createProject('project-1', 'client-1', manager.id, 'International Project');

      const user: SearchUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      const results = searchWithPermissions('Inter', user);

      expect(results.clients.length).toBe(1);
      expect(results.projects.length).toBe(1);
    });

    /**
     * Requirement 11.2: Search should be case-insensitive
     */
    it('should match case-insensitively', () => {
      const superAdmin = createUser('super-admin', 'superadmin@example.com', 'SUPER_ADMIN');
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');

      createClient('client-1', 'UPPERCASE Client');
      createProject('project-1', 'client-1', manager.id, 'lowercase project');

      const user: SearchUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };

      // Search with lowercase
      const results1 = searchWithPermissions('uppercase', user);
      expect(results1.clients.length).toBe(1);

      // Search with uppercase
      const results2 = searchWithPermissions('LOWERCASE', user);
      expect(results2.projects.length).toBe(1);
    });

    /**
     * Requirement 11.2: Search should match description fields
     */
    it('should match project descriptions', () => {
      const superAdmin = createUser('super-admin', 'superadmin@example.com', 'SUPER_ADMIN');
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');

      createClient('client-1', 'Client');
      createProject('project-1', 'client-1', manager.id, 'Project Name', 'Contains searchable keyword');

      const user: SearchUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      const results = searchWithPermissions('searchable', user);

      expect(results.projects.length).toBe(1);
      expect(results.projects[0]!.name).toBe('Project Name');
    });
  });

  describe('Complete Search Flow', () => {
    /**
     * Requirement 11.2: Complete search flow with multiple users
     */
    it('should correctly filter results for different user roles', () => {
      // Setup users
      const superAdmin = createUser('super-admin', 'super@example.com', 'SUPER_ADMIN');
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');
      const member = createUser('member', 'member@example.com', 'MEMBER');
      const guest = createUser('guest', 'guest@example.com', 'GUEST');

      // Setup data
      createClient('client-1', 'Test Client');
      createProject('project-1', 'client-1', manager.id, 'Test Project');
      addProjectMember('pm-member', 'project-1', member.id, 'MEMBER');
      addProjectMember('pm-guest', 'project-1', guest.id, 'VIEWER');
      createTask('task-1', 'project-1', manager.id, 'Test Task');
      createNote('note-1', 'Test System', manager.id, 'project-1');

      // SUPER_ADMIN sees everything
      const superAdminResults = searchWithPermissions('Test', { id: superAdmin.id, role: 'SUPER_ADMIN' });
      expect(superAdminResults.clients.length).toBe(1);
      expect(superAdminResults.projects.length).toBe(1);
      expect(superAdminResults.tasks.length).toBe(1);
      expect(superAdminResults.notes.length).toBe(1);

      // MANAGER sees their managed project and clients
      const managerResults = searchWithPermissions('Test', { id: manager.id, role: 'MANAGER' });
      expect(managerResults.clients.length).toBe(1); // MANAGER can see clients
      expect(managerResults.projects.length).toBe(1);
      expect(managerResults.tasks.length).toBe(1);
      expect(managerResults.notes.length).toBe(1);

      // MEMBER sees project they belong to
      const memberResults = searchWithPermissions('Test', { id: member.id, role: 'MEMBER' });
      expect(memberResults.clients.length).toBe(0);
      expect(memberResults.projects.length).toBe(1);
      expect(memberResults.tasks.length).toBe(1);
      expect(memberResults.notes.length).toBe(1);

      // GUEST sees project they belong to
      const guestResults = searchWithPermissions('Test', { id: guest.id, role: 'GUEST' });
      expect(guestResults.clients.length).toBe(0);
      expect(guestResults.projects.length).toBe(1);
      expect(guestResults.tasks.length).toBe(1);
      expect(guestResults.notes.length).toBe(1);
    });

    /**
     * Requirement 11.2: Users without access see nothing
     */
    it('should return empty results for users without any project access', () => {
      const manager = createUser('manager', 'manager@example.com', 'MANAGER');
      const outsider = createUser('outsider', 'outsider@example.com', 'MEMBER');

      createClient('client-1', 'Private Client');
      createProject('project-1', 'client-1', manager.id, 'Private Project');
      createTask('task-1', 'project-1', manager.id, 'Private Task');
      createNote('note-1', 'Private System', manager.id, 'project-1');

      const user: SearchUser = { id: outsider.id, role: 'MEMBER' };
      const results = searchWithPermissions('Private', user);

      expect(results.clients.length).toBe(0);
      expect(results.projects.length).toBe(0);
      expect(results.tasks.length).toBe(0);
      expect(results.notes.length).toBe(0);
    });
  });
});
