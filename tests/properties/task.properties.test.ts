/**
 * Property-based tests for task management
 * Tests task status grouping, task move updates status, and overdue detection
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/lib/db/schema/index';
import { sql } from 'drizzle-orm';

const PBT_RUNS = 100;

// Task status values (Kanban columns)
const taskStatusValues = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'DONE',
] as const;
type TaskStatus = (typeof taskStatusValues)[number];

const priorityValues = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

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

  // Create tasks table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'BACKLOG',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      due_date INTEGER,
      estimated_hours REAL,
      actual_hours REAL,
      linked_note_id TEXT,
      task_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create indexes
  db.run(sql`CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date)`);
}

/**
 * Helper function to group tasks by status (simulates Kanban board grouping)
 */
function groupTasksByStatus(
  tasks: Array<{ id: string; status: string; title: string }>
): Map<string, Array<{ id: string; status: string; title: string }>> {
  const groups = new Map<string, Array<{ id: string; status: string; title: string }>>();
  
  // Initialize all columns
  for (const status of taskStatusValues) {
    groups.set(status, []);
  }
  
  // Group tasks
  for (const task of tasks) {
    const group = groups.get(task.status);
    if (group) {
      group.push(task);
    }
  }
  
  return groups;
}

/**
 * Helper function to move a task to a new status (simulates Kanban drag-drop)
 */
function moveTask(
  db: ReturnType<typeof createTestDb>['db'],
  taskId: string,
  newStatus: TaskStatus,
  newOrder: number
): void {
  db.run(sql`
    UPDATE tasks 
    SET status = ${newStatus}, task_order = ${newOrder}, updated_at = unixepoch()
    WHERE id = ${taskId}
  `);
}

/**
 * Helper function to check if a task is overdue
 */
function isTaskOverdue(dueDate: number | null, status: string): boolean {
  if (!dueDate) return false;
  if (status === 'DONE') return false;
  const now = Math.floor(Date.now() / 1000);
  return dueDate < now;
}

describe('Task Status Grouping Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 15: Task Status Grouping**
   * *For any* project's Kanban board view, tasks should be grouped into columns
   * where each task's status matches its column identifier.
   * **Validates: Requirements 6.1**
   */
  it('Property 15: Task Status Grouping - tasks grouped by status match column', async () => {
    // Create base test data
    const clientId = 'test-client-grp';
    const projectId = 'test-project-grp';
    const managerId = 'test-manager-grp';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Grp')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-grp@test.com', 'hash', 'Manager Grp', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project Grp', ${managerId})
    `);

    const taskStatusArb = fc.constantFrom(...taskStatusValues);
    const priorityArb = fc.constantFrom(...priorityValues);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            status: taskStatusArb,
            priority: priorityArb,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (taskInputs) => {
          // Clear existing tasks
          testDb.db.run(sql`DELETE FROM tasks WHERE project_id = ${projectId}`);

          // Insert tasks with various statuses
          for (let i = 0; i < taskInputs.length; i++) {
            const task = taskInputs[i]!;
            testDb.db.run(sql`
              INSERT OR IGNORE INTO tasks (id, project_id, title, status, priority, reporter_id, task_order)
              VALUES (${task.id}, ${projectId}, ${task.title}, ${task.status}, ${task.priority}, ${managerId}, ${i})
            `);
          }

          // Query all tasks for the project
          const allTasks = testDb.db.all(sql`
            SELECT id, status, title FROM tasks WHERE project_id = ${projectId}
          `) as Array<{ id: string; status: string; title: string }>;

          // Group tasks by status (simulating Kanban board)
          const groupedTasks = groupTasksByStatus(allTasks);

          // Verify each task in each column has the correct status
          for (const [columnStatus, tasksInColumn] of groupedTasks) {
            for (const task of tasksInColumn) {
              if (task.status !== columnStatus) {
                return false;
              }
            }
          }

          // Verify all tasks are accounted for
          let totalGrouped = 0;
          for (const [, tasksInColumn] of groupedTasks) {
            totalGrouped += tasksInColumn.length;
          }
          if (totalGrouped !== allTasks.length) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 15: Task Status Grouping**
   * All 6 Kanban columns should exist even when empty
   * **Validates: Requirements 6.1**
   */
  it('Property 15: Task Status Grouping - all columns exist even when empty', () => {
    // Create empty task list
    const emptyTasks: Array<{ id: string; status: string; title: string }> = [];
    
    // Group tasks
    const groupedTasks = groupTasksByStatus(emptyTasks);
    
    // Verify all 6 columns exist
    expect(groupedTasks.size).toBe(6);
    expect(groupedTasks.has('BACKLOG')).toBe(true);
    expect(groupedTasks.has('TODO')).toBe(true);
    expect(groupedTasks.has('IN_PROGRESS')).toBe(true);
    expect(groupedTasks.has('IN_REVIEW')).toBe(true);
    expect(groupedTasks.has('CHANGES_REQUESTED')).toBe(true);
    expect(groupedTasks.has('DONE')).toBe(true);
    
    // All columns should be empty
    for (const [, tasks] of groupedTasks) {
      expect(tasks.length).toBe(0);
    }
  });
});

describe('Task Move Updates Status Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 16: Task Move Updates Status**
   * *For any* task and target status column, moving the task to that column
   * should update the task's status to match the column.
   * **Validates: Requirements 6.2**
   */
  it('Property 16: Task Move Updates Status - moving task updates status', async () => {
    // Create base test data
    const clientId = 'test-client-move';
    const projectId = 'test-project-move';
    const managerId = 'test-manager-move';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Move')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-move@test.com', 'hash', 'Manager Move', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project Move', ${managerId})
    `);

    const taskStatusArb = fc.constantFrom(...taskStatusValues);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        taskStatusArb,
        taskStatusArb,
        fc.integer({ min: 0, max: 100 }),
        async (taskId, title, initialStatus, targetStatus, newOrder) => {
          // Clear existing task with this ID
          testDb.db.run(sql`DELETE FROM tasks WHERE id = ${taskId}`);

          // Create task with initial status
          testDb.db.run(sql`
            INSERT INTO tasks (id, project_id, title, status, reporter_id, task_order)
            VALUES (${taskId}, ${projectId}, ${title}, ${initialStatus}, ${managerId}, 0)
          `);

          // Verify initial status
          const beforeMove = testDb.db.all(sql`
            SELECT status FROM tasks WHERE id = ${taskId}
          `) as Array<{ status: string }>;

          if (beforeMove[0]?.status !== initialStatus) {
            return false;
          }

          // Move task to target status
          moveTask(testDb.db, taskId, targetStatus, newOrder);

          // Verify status was updated
          const afterMove = testDb.db.all(sql`
            SELECT status, task_order FROM tasks WHERE id = ${taskId}
          `) as Array<{ status: string; task_order: number }>;

          if (afterMove[0]?.status !== targetStatus) {
            return false;
          }

          if (afterMove[0]?.task_order !== newOrder) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 16: Task Move Updates Status**
   * Moving a task to the same status should preserve the status
   * **Validates: Requirements 6.2**
   */
  it('Property 16: Task Move Updates Status - moving to same status is idempotent', async () => {
    // Create base test data
    const clientId = 'test-client-move2';
    const projectId = 'test-project-move2';
    const managerId = 'test-manager-move2';
    const taskId = 'test-task-move2';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client Move2')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-move2@test.com', 'hash', 'Manager Move2', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project Move2', ${managerId})
    `);

    // Insert test task
    testDb.db.run(sql`
      INSERT INTO tasks (id, project_id, title, status, reporter_id, task_order)
      VALUES (${taskId}, ${projectId}, 'Test Task', 'IN_PROGRESS', ${managerId}, 5)
    `);

    // Move to same status with different order
    moveTask(testDb.db, taskId, 'IN_PROGRESS', 10);

    // Verify status unchanged, order updated
    const result = testDb.db.all(sql`
      SELECT status, task_order FROM tasks WHERE id = ${taskId}
    `) as Array<{ status: string; task_order: number }>;

    expect(result[0]?.status).toBe('IN_PROGRESS');
    expect(result[0]?.task_order).toBe(10);
  });
});

describe('Overdue Task Detection Properties', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 17: Overdue Task Detection**
   * *For any* task with a due date in the past and status not equal to DONE,
   * the task should be marked as overdue in query results.
   * **Validates: Requirements 5.5**
   */
  it('Property 17: Overdue Task Detection - past due date with non-DONE status is overdue', async () => {
    const nonDoneStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED'] as const;
    const nonDoneStatusArb = fc.constantFrom(...nonDoneStatuses);

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 365 }), // days in the past
        nonDoneStatusArb,
        async (daysInPast, status) => {
          // Calculate past due date (Unix timestamp)
          const now = Math.floor(Date.now() / 1000);
          const pastDueDate = now - (daysInPast * 24 * 60 * 60);

          // Check if task is overdue
          const isOverdue = isTaskOverdue(pastDueDate, status);

          // Task with past due date and non-DONE status should be overdue
          return isOverdue === true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 17: Overdue Task Detection**
   * Tasks with DONE status are never overdue regardless of due date
   * **Validates: Requirements 5.5**
   */
  it('Property 17: Overdue Task Detection - DONE tasks are never overdue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 365 }), // days in the past
        async (daysInPast) => {
          // Calculate past due date (Unix timestamp)
          const now = Math.floor(Date.now() / 1000);
          const pastDueDate = now - (daysInPast * 24 * 60 * 60);

          // Check if DONE task is overdue
          const isOverdue = isTaskOverdue(pastDueDate, 'DONE');

          // DONE tasks should never be overdue
          return isOverdue === false;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 17: Overdue Task Detection**
   * Tasks with future due dates are never overdue
   * **Validates: Requirements 5.5**
   */
  it('Property 17: Overdue Task Detection - future due dates are not overdue', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 365 }), // days in the future
        taskStatusArb,
        async (daysInFuture, status) => {
          // Calculate future due date (Unix timestamp)
          const now = Math.floor(Date.now() / 1000);
          const futureDueDate = now + (daysInFuture * 24 * 60 * 60);

          // Check if task is overdue
          const isOverdue = isTaskOverdue(futureDueDate, status);

          // Tasks with future due dates should not be overdue
          return isOverdue === false;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 17: Overdue Task Detection**
   * Tasks without due dates are never overdue
   * **Validates: Requirements 5.5**
   */
  it('Property 17: Overdue Task Detection - tasks without due dates are not overdue', async () => {
    const taskStatusArb = fc.constantFrom(...taskStatusValues);

    await fc.assert(
      fc.asyncProperty(
        taskStatusArb,
        async (status) => {
          // Check if task without due date is overdue
          const isOverdue = isTaskOverdue(null, status);

          // Tasks without due dates should not be overdue
          return isOverdue === false;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 17: Overdue Task Detection**
   * Completing an overdue task removes the overdue flag
   * **Validates: Requirements 5.5**
   */
  it('Property 17: Overdue Task Detection - completing task removes overdue flag', async () => {
    // Create base test data
    const clientId = 'test-client-od';
    const projectId = 'test-project-od';
    const managerId = 'test-manager-od';
    const taskId = 'test-task-od';

    // Insert test client
    testDb.db.run(sql`
      INSERT INTO clients (id, name) VALUES (${clientId}, 'Test Client OD')
    `);

    // Insert test manager user
    testDb.db.run(sql`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (${managerId}, 'manager-od@test.com', 'hash', 'Manager OD', 'MANAGER')
    `);

    // Insert test project
    testDb.db.run(sql`
      INSERT INTO projects (id, client_id, name, manager_id)
      VALUES (${projectId}, ${clientId}, 'Test Project OD', ${managerId})
    `);

    // Calculate past due date
    const now = Math.floor(Date.now() / 1000);
    const pastDueDate = now - (7 * 24 * 60 * 60); // 7 days ago

    // Insert overdue task
    testDb.db.run(sql`
      INSERT INTO tasks (id, project_id, title, status, reporter_id, due_date, task_order)
      VALUES (${taskId}, ${projectId}, 'Overdue Task', 'IN_PROGRESS', ${managerId}, ${pastDueDate}, 0)
    `);

    // Verify task is overdue
    const beforeComplete = testDb.db.all(sql`
      SELECT status, due_date FROM tasks WHERE id = ${taskId}
    `) as Array<{ status: string; due_date: number }>;

    expect(isTaskOverdue(beforeComplete[0]?.due_date ?? null, beforeComplete[0]?.status ?? '')).toBe(true);

    // Complete the task
    testDb.db.run(sql`
      UPDATE tasks SET status = 'DONE' WHERE id = ${taskId}
    `);

    // Verify task is no longer overdue
    const afterComplete = testDb.db.all(sql`
      SELECT status, due_date FROM tasks WHERE id = ${taskId}
    `) as Array<{ status: string; due_date: number }>;

    expect(isTaskOverdue(afterComplete[0]?.due_date ?? null, afterComplete[0]?.status ?? '')).toBe(false);
  });
});
