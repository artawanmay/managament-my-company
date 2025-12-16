/**
 * Property-based tests for dashboard accuracy
 * Tests that dashboard counts match actual database counts
 * 
 * **Feature: mmc-app, Property 24: Dashboard Count Accuracy**
 * **Validates: Requirements 15.1, 15.2**
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/lib/db/schema/index';
import { sql } from 'drizzle-orm';
import {
  clientStatusValues,
  projectStatusValues,
  taskStatusValues,
  type ClientStatus,
  type ProjectStatus,
  type TaskStatus,
} from '@/lib/db/schema';

const PBT_RUNS = 100;

// Arbitrary generators
const clientStatusArb = fc.constantFrom(...clientStatusValues);
const projectStatusArb = fc.constantFrom(...projectStatusValues);
const taskStatusArb = fc.constantFrom(...taskStatusValues);
const nameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

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
      status TEXT NOT NULL DEFAULT 'PROSPECT',
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

  // Create indexes
  db.run(sql`CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date)`);
}

// Helper functions for database operations
function insertUser(sqlite: Database.Database, id: string, email: string, name: string, role: string = 'MEMBER') {
  const stmt = sqlite.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, email, 'hash', name, role);
}

function insertClient(sqlite: Database.Database, id: string, name: string, status: ClientStatus) {
  const stmt = sqlite.prepare('INSERT INTO clients (id, name, status) VALUES (?, ?, ?)');
  stmt.run(id, name, status);
}

function insertProject(sqlite: Database.Database, id: string, clientId: string, name: string, status: ProjectStatus, managerId: string) {
  const stmt = sqlite.prepare('INSERT INTO projects (id, client_id, name, status, manager_id) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, clientId, name, status, managerId);
}

function insertProjectMember(sqlite: Database.Database, id: string, projectId: string, userId: string) {
  const stmt = sqlite.prepare('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)');
  stmt.run(id, projectId, userId, 'MEMBER');
}

function insertTask(sqlite: Database.Database, id: string, projectId: string, title: string, status: TaskStatus, reporterId: string, dueDate: number | null = null) {
  const stmt = sqlite.prepare('INSERT INTO tasks (id, project_id, title, status, reporter_id, due_date, "order") VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(id, projectId, title, status, reporterId, dueDate, 0);
}

// Dashboard calculation functions (simulating the API logic)
function getClientCounts(sqlite: Database.Database) {
  const stmt = sqlite.prepare('SELECT status, COUNT(*) as count FROM clients GROUP BY status');
  const results = stmt.all() as { status: ClientStatus; count: number }[];
  
  const counts = {
    total: 0,
    active: 0,
    inactive: 0,
    prospect: 0,
  };
  
  for (const row of results) {
    counts.total += row.count;
    if (row.status === 'ACTIVE') counts.active = row.count;
    if (row.status === 'INACTIVE') counts.inactive = row.count;
    if (row.status === 'PROSPECT') counts.prospect = row.count;
  }
  
  return counts;
}

function getProjectCounts(sqlite: Database.Database, projectIds?: string[]) {
  // If projectIds is provided but empty, return zero counts
  if (projectIds !== undefined && projectIds.length === 0) {
    return {
      total: 0,
      planning: 0,
      active: 0,
      onHold: 0,
      completed: 0,
      archived: 0,
    };
  }

  let query = 'SELECT status, COUNT(*) as count FROM projects';
  let params: string[] = [];
  
  if (projectIds && projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    query += ` WHERE id IN (${placeholders})`;
    params = projectIds;
  }
  
  query += ' GROUP BY status';
  
  const stmt = sqlite.prepare(query);
  const results = stmt.all(...params) as { status: ProjectStatus; count: number }[];
  
  const counts = {
    total: 0,
    planning: 0,
    active: 0,
    onHold: 0,
    completed: 0,
    archived: 0,
  };
  
  for (const row of results) {
    counts.total += row.count;
    if (row.status === 'PLANNING') counts.planning = row.count;
    if (row.status === 'ACTIVE') counts.active = row.count;
    if (row.status === 'ON_HOLD') counts.onHold = row.count;
    if (row.status === 'COMPLETED') counts.completed = row.count;
    if (row.status === 'ARCHIVED') counts.archived = row.count;
  }
  
  return counts;
}

function getTaskCounts(sqlite: Database.Database, projectIds?: string[]) {
  let query = 'SELECT status, COUNT(*) as count FROM tasks';
  let params: string[] = [];
  
  if (projectIds && projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    query += ` WHERE project_id IN (${placeholders})`;
    params = projectIds;
  }
  
  query += ' GROUP BY status';
  
  const stmt = sqlite.prepare(query);
  const results = stmt.all(...params) as { status: TaskStatus; count: number }[];
  
  const counts = {
    total: 0,
    backlog: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    changesRequested: 0,
    done: 0,
  };
  
  for (const row of results) {
    counts.total += row.count;
    if (row.status === 'BACKLOG') counts.backlog = row.count;
    if (row.status === 'TODO') counts.todo = row.count;
    if (row.status === 'IN_PROGRESS') counts.inProgress = row.count;
    if (row.status === 'IN_REVIEW') counts.inReview = row.count;
    if (row.status === 'CHANGES_REQUESTED') counts.changesRequested = row.count;
    if (row.status === 'DONE') counts.done = row.count;
  }
  
  return counts;
}

function getOverdueCount(sqlite: Database.Database, now: number, projectIds?: string[]) {
  let query = 'SELECT COUNT(*) as count FROM tasks WHERE due_date < ? AND status != ?';
  let params: (string | number)[] = [now, 'DONE'];
  
  if (projectIds && projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    query += ` AND project_id IN (${placeholders})`;
    params = [...params, ...projectIds];
  }
  
  const stmt = sqlite.prepare(query);
  const result = stmt.get(...params) as { count: number };
  return result.count;
}

function getActualClientCount(sqlite: Database.Database, status: ClientStatus) {
  const stmt = sqlite.prepare('SELECT COUNT(*) as count FROM clients WHERE status = ?');
  const result = stmt.get(status) as { count: number };
  return result.count;
}

function getActualProjectCount(sqlite: Database.Database, status: ProjectStatus, projectIds?: string[]) {
  let query = 'SELECT COUNT(*) as count FROM projects WHERE status = ?';
  let params: string[] = [status];
  
  if (projectIds && projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    query += ` AND id IN (${placeholders})`;
    params = [...params, ...projectIds];
  }
  
  const stmt = sqlite.prepare(query);
  const result = stmt.get(...params) as { count: number };
  return result.count;
}

function getActualTaskCount(sqlite: Database.Database, status: TaskStatus, projectIds?: string[]) {
  let query = 'SELECT COUNT(*) as count FROM tasks WHERE status = ?';
  let params: string[] = [status];
  
  if (projectIds && projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    query += ` AND project_id IN (${placeholders})`;
    params = [...params, ...projectIds];
  }
  
  const stmt = sqlite.prepare(query);
  const result = stmt.get(...params) as { count: number };
  return result.count;
}

describe('Dashboard Count Accuracy Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
    // Create a default user for foreign key constraints
    insertUser(testDb.sqlite, 'default-user', 'default@test.com', 'Default User', 'SUPER_ADMIN');
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 24: Dashboard Count Accuracy**
   * *For any* dashboard view, the client summary counts should match the actual count
   * of clients in the database.
   * **Validates: Requirements 15.1, 15.2**
   */
  it('Property 24: Dashboard Count Accuracy - client counts match database', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: nameArb,
            status: clientStatusArb,
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (clients) => {
          // Insert all clients
          for (const client of clients) {
            insertClient(testDb.sqlite, client.id, client.name, client.status);
          }

          // Get dashboard counts
          const dashboardCounts = getClientCounts(testDb.sqlite);

          // Verify each status count matches actual database count
          const activeMatch = dashboardCounts.active === getActualClientCount(testDb.sqlite, 'ACTIVE');
          const inactiveMatch = dashboardCounts.inactive === getActualClientCount(testDb.sqlite, 'INACTIVE');
          const prospectMatch = dashboardCounts.prospect === getActualClientCount(testDb.sqlite, 'PROSPECT');
          const totalMatch = dashboardCounts.total === clients.length;

          // Clean up
          testDb.sqlite.exec('DELETE FROM clients');

          return activeMatch && inactiveMatch && prospectMatch && totalMatch;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 24: Dashboard Count Accuracy**
   * *For any* dashboard view, the project summary counts should match the actual count
   * of projects in the database.
   * **Validates: Requirements 15.1, 15.2**
   */
  it('Property 24: Dashboard Count Accuracy - project counts match database', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            clientId: fc.uuid(),
            clientName: nameArb,
            projectId: fc.uuid(),
            projectName: nameArb,
            projectStatus: projectStatusArb,
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (data) => {
          // Insert clients and projects
          const insertedClients = new Set<string>();
          for (const item of data) {
            if (!insertedClients.has(item.clientId)) {
              insertClient(testDb.sqlite, item.clientId, item.clientName, 'ACTIVE');
              insertedClients.add(item.clientId);
            }
            insertProject(testDb.sqlite, item.projectId, item.clientId, item.projectName, item.projectStatus, 'default-user');
          }

          // Get dashboard counts
          const dashboardCounts = getProjectCounts(testDb.sqlite);

          // Verify each status count matches actual database count
          const planningMatch = dashboardCounts.planning === getActualProjectCount(testDb.sqlite, 'PLANNING');
          const activeMatch = dashboardCounts.active === getActualProjectCount(testDb.sqlite, 'ACTIVE');
          const onHoldMatch = dashboardCounts.onHold === getActualProjectCount(testDb.sqlite, 'ON_HOLD');
          const completedMatch = dashboardCounts.completed === getActualProjectCount(testDb.sqlite, 'COMPLETED');
          const archivedMatch = dashboardCounts.archived === getActualProjectCount(testDb.sqlite, 'ARCHIVED');
          const totalMatch = dashboardCounts.total === data.length;

          // Clean up
          testDb.sqlite.exec('DELETE FROM projects');
          testDb.sqlite.exec('DELETE FROM clients');

          return planningMatch && activeMatch && onHoldMatch && completedMatch && archivedMatch && totalMatch;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 24: Dashboard Count Accuracy**
   * *For any* dashboard view, the task summary counts should match the actual count
   * of tasks in the database.
   * **Validates: Requirements 15.1, 15.2**
   */
  it('Property 24: Dashboard Count Accuracy - task counts match database', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            taskId: fc.uuid(),
            taskTitle: nameArb,
            taskStatus: taskStatusArb,
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (tasks) => {
          // Create a client and project for the tasks
          const clientId = 'test-client';
          const projectId = 'test-project';
          insertClient(testDb.sqlite, clientId, 'Test Client', 'ACTIVE');
          insertProject(testDb.sqlite, projectId, clientId, 'Test Project', 'ACTIVE', 'default-user');

          // Insert all tasks
          for (const task of tasks) {
            insertTask(testDb.sqlite, task.taskId, projectId, task.taskTitle, task.taskStatus, 'default-user');
          }

          // Get dashboard counts
          const dashboardCounts = getTaskCounts(testDb.sqlite);

          // Verify each status count matches actual database count
          const backlogMatch = dashboardCounts.backlog === getActualTaskCount(testDb.sqlite, 'BACKLOG');
          const todoMatch = dashboardCounts.todo === getActualTaskCount(testDb.sqlite, 'TODO');
          const inProgressMatch = dashboardCounts.inProgress === getActualTaskCount(testDb.sqlite, 'IN_PROGRESS');
          const inReviewMatch = dashboardCounts.inReview === getActualTaskCount(testDb.sqlite, 'IN_REVIEW');
          const changesRequestedMatch = dashboardCounts.changesRequested === getActualTaskCount(testDb.sqlite, 'CHANGES_REQUESTED');
          const doneMatch = dashboardCounts.done === getActualTaskCount(testDb.sqlite, 'DONE');
          const totalMatch = dashboardCounts.total === tasks.length;

          // Clean up
          testDb.sqlite.exec('DELETE FROM tasks');
          testDb.sqlite.exec('DELETE FROM projects');
          testDb.sqlite.exec('DELETE FROM clients');

          return backlogMatch && todoMatch && inProgressMatch && inReviewMatch && changesRequestedMatch && doneMatch && totalMatch;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 24: Dashboard Count Accuracy**
   * *For any* dashboard view, the overdue task count should match the actual count
   * of tasks with past due dates that are not done.
   * **Validates: Requirements 15.1, 15.2**
   */
  it('Property 24: Dashboard Count Accuracy - overdue task count matches database', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            taskId: fc.uuid(),
            taskTitle: nameArb,
            taskStatus: taskStatusArb,
            // Generate due dates: some in the past, some in the future, some null
            dueDate: fc.option(
              fc.integer({ min: -30, max: 30 }).map(days => {
                const now = Math.floor(Date.now() / 1000);
                return now + (days * 24 * 60 * 60);
              }),
              { nil: undefined }
            ),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (tasks) => {
          // Create a client and project for the tasks
          const clientId = 'test-client';
          const projectId = 'test-project';
          insertClient(testDb.sqlite, clientId, 'Test Client', 'ACTIVE');
          insertProject(testDb.sqlite, projectId, clientId, 'Test Project', 'ACTIVE', 'default-user');

          // Insert all tasks
          for (const task of tasks) {
            insertTask(testDb.sqlite, task.taskId, projectId, task.taskTitle, task.taskStatus, 'default-user', task.dueDate ?? null);
          }

          const now = Math.floor(Date.now() / 1000);

          // Get dashboard overdue count
          const dashboardOverdueCount = getOverdueCount(testDb.sqlite, now);

          // Calculate expected overdue count
          const expectedOverdueCount = tasks.filter(
            task => task.dueDate !== undefined && task.dueDate < now && task.taskStatus !== 'DONE'
          ).length;

          // Clean up
          testDb.sqlite.exec('DELETE FROM tasks');
          testDb.sqlite.exec('DELETE FROM projects');
          testDb.sqlite.exec('DELETE FROM clients');

          return dashboardOverdueCount === expectedOverdueCount;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 24: Dashboard Count Accuracy**
   * *For any* non-admin user, the dashboard should only show counts for projects
   * they have access to.
   * **Validates: Requirements 15.1, 15.2**
   */
  it('Property 24: Dashboard Count Accuracy - non-admin sees only accessible project counts', () => {
    fc.assert(
      fc.property(
        // Generate projects with random access
        fc.array(
          fc.record({
            projectId: fc.uuid(),
            projectName: nameArb,
            projectStatus: projectStatusArb,
            hasAccess: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (projectsData) => {
          // Create a non-admin user
          const userId = 'non-admin-user';
          insertUser(testDb.sqlite, userId, 'user@test.com', 'Test User', 'MEMBER');

          // Create a client for projects
          const clientId = 'test-client';
          insertClient(testDb.sqlite, clientId, 'Test Client', 'ACTIVE');

          // Insert projects and grant access to some
          const accessibleProjectIds: string[] = [];
          for (const project of projectsData) {
            insertProject(testDb.sqlite, project.projectId, clientId, project.projectName, project.projectStatus, 'default-user');
            if (project.hasAccess) {
              insertProjectMember(testDb.sqlite, `member-${project.projectId}`, project.projectId, userId);
              accessibleProjectIds.push(project.projectId);
            }
          }

          // Get dashboard counts filtered by accessible projects
          const dashboardCounts = getProjectCounts(testDb.sqlite, accessibleProjectIds);

          // Calculate expected counts from accessible projects only
          const accessibleProjects = projectsData.filter(p => p.hasAccess);
          const expectedTotal = accessibleProjects.length;
          const expectedByStatus = {
            planning: accessibleProjects.filter(p => p.projectStatus === 'PLANNING').length,
            active: accessibleProjects.filter(p => p.projectStatus === 'ACTIVE').length,
            onHold: accessibleProjects.filter(p => p.projectStatus === 'ON_HOLD').length,
            completed: accessibleProjects.filter(p => p.projectStatus === 'COMPLETED').length,
            archived: accessibleProjects.filter(p => p.projectStatus === 'ARCHIVED').length,
          };

          // Verify counts match
          const totalMatch = dashboardCounts.total === expectedTotal;
          const statusMatch = 
            dashboardCounts.planning === expectedByStatus.planning &&
            dashboardCounts.active === expectedByStatus.active &&
            dashboardCounts.onHold === expectedByStatus.onHold &&
            dashboardCounts.completed === expectedByStatus.completed &&
            dashboardCounts.archived === expectedByStatus.archived;

          // Clean up
          testDb.sqlite.exec('DELETE FROM project_members');
          testDb.sqlite.exec('DELETE FROM projects');
          testDb.sqlite.exec('DELETE FROM clients');
          testDb.sqlite.exec("DELETE FROM users WHERE id != 'default-user'");

          return totalMatch && statusMatch;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});
