/**
 * Integration tests for Client-Project-Task workflow
 * Tests full CRUD workflow with permission verification
 *
 * Requirements: 3.1, 4.1, 5.1, 25.6
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema/index';
import {
  canAccessProject,
  canManageProject,
  canCreateTask,
  canEditTask,
  isProjectMember,
  setDatabase,
  resetDatabase,
  type PermissionUser,
} from '@/lib/auth/permissions';

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

  // Set the test database for permissions module
  setDatabase(db as unknown as Parameters<typeof setDatabase>[0]);
}

function cleanupTestDb() {
  resetDatabase();
  if (sqlite) {
    sqlite.close();
  }
}

// Helper functions
function createUser(id: string, email: string, role: string = 'MEMBER') {
  db.run(sql`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (${id}, ${email}, 'hash', 'Test User', ${role})
  `);
  return { id, email, role };
}

function createClient(id: string, name: string, status: string = 'ACTIVE') {
  db.run(sql`
    INSERT INTO clients (id, name, status)
    VALUES (${id}, ${name}, ${status})
  `);
  return { id, name, status };
}

function createProject(
  id: string,
  clientId: string,
  managerId: string,
  name: string,
  status: string = 'ACTIVE'
) {
  db.run(sql`
    INSERT INTO projects (id, client_id, manager_id, name, status)
    VALUES (${id}, ${clientId}, ${managerId}, ${name}, ${status})
  `);
  return { id, clientId, managerId, name, status };
}

function addProjectMember(
  id: string,
  projectId: string,
  userId: string,
  role: string = 'MEMBER'
) {
  db.run(sql`
    INSERT INTO project_members (id, project_id, user_id, role)
    VALUES (${id}, ${projectId}, ${userId}, ${role})
  `);
  return { id, projectId, userId, role };
}

function createTask(
  id: string,
  projectId: string,
  reporterId: string,
  title: string,
  status: string = 'BACKLOG',
  assigneeId?: string
) {
  db.run(sql`
    INSERT INTO tasks (id, project_id, reporter_id, title, status, assignee_id)
    VALUES (${id}, ${projectId}, ${reporterId}, ${title}, ${status}, ${assigneeId ?? null})
  `);
  return { id, projectId, reporterId, title, status, assigneeId };
}

describe('Client-Project-Task Workflow Integration Tests', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  describe('Client CRUD Operations', () => {
    /**
     * Requirement 3.1: Create client
     */
    it('should create a client', () => {
      const client = createClient('client-1', 'Acme Corp', 'ACTIVE');

      const clients = db.all(sql`SELECT * FROM clients WHERE id = ${client.id}`);
      expect(clients.length).toBe(1);
      expect((clients[0] as { name: string }).name).toBe('Acme Corp');
    });

    /**
     * Requirement 3.1: Read client
     */
    it('should read client details', () => {
      createClient('client-2', 'Tech Inc', 'PROSPECT');

      const clients = db.all(sql`SELECT * FROM clients WHERE id = ${'client-2'}`);
      expect(clients.length).toBe(1);
      const client = clients[0] as { name: string; status: string };
      expect(client.name).toBe('Tech Inc');
      expect(client.status).toBe('PROSPECT');
    });

    /**
     * Requirement 3.1: Update client
     */
    it('should update client', () => {
      createClient('client-3', 'Old Name', 'PROSPECT');

      db.run(sql`UPDATE clients SET name = ${'New Name'}, status = ${'ACTIVE'} WHERE id = ${'client-3'}`);

      const clients = db.all(sql`SELECT * FROM clients WHERE id = ${'client-3'}`);
      const client = clients[0] as { name: string; status: string };
      expect(client.name).toBe('New Name');
      expect(client.status).toBe('ACTIVE');
    });

    /**
     * Requirement 3.1: Delete client
     */
    it('should delete client', () => {
      createClient('client-4', 'To Delete', 'INACTIVE');

      db.run(sql`DELETE FROM clients WHERE id = ${'client-4'}`);

      const clients = db.all(sql`SELECT * FROM clients WHERE id = ${'client-4'}`);
      expect(clients.length).toBe(0);
    });
  });

  describe('Project CRUD Operations', () => {
    /**
     * Requirement 4.1: Create project
     */
    it('should create a project linked to client', () => {
      const manager = createUser('manager-1', 'manager@example.com', 'MANAGER');
      createClient('client-p1', 'Client Corp');

      const project = createProject('project-1', 'client-p1', manager.id, 'New Project');

      const projects = db.all(sql`SELECT * FROM projects WHERE id = ${project.id}`);
      expect(projects.length).toBe(1);
      const p = projects[0] as { name: string; client_id: string; manager_id: string };
      expect(p.name).toBe('New Project');
      expect(p.client_id).toBe('client-p1');
      expect(p.manager_id).toBe(manager.id);
    });

    /**
     * Requirement 4.1: Read project
     */
    it('should read project with client association', () => {
      const manager = createUser('manager-2', 'manager2@example.com', 'MANAGER');
      createClient('client-p2', 'Client Two');
      createProject('project-2', 'client-p2', manager.id, 'Project Two', 'ACTIVE');

      const projects = db.all(sql`
        SELECT p.*, c.name as client_name 
        FROM projects p 
        JOIN clients c ON p.client_id = c.id 
        WHERE p.id = ${'project-2'}
      `);
      expect(projects.length).toBe(1);
      const p = projects[0] as { name: string; client_name: string; status: string };
      expect(p.name).toBe('Project Two');
      expect(p.client_name).toBe('Client Two');
      expect(p.status).toBe('ACTIVE');
    });

    /**
     * Requirement 4.1: Update project
     */
    it('should update project status', () => {
      const manager = createUser('manager-3', 'manager3@example.com', 'MANAGER');
      createClient('client-p3', 'Client Three');
      createProject('project-3', 'client-p3', manager.id, 'Project Three', 'PLANNING');

      db.run(sql`UPDATE projects SET status = ${'ACTIVE'} WHERE id = ${'project-3'}`);

      const projects = db.all(sql`SELECT * FROM projects WHERE id = ${'project-3'}`);
      expect((projects[0] as { status: string }).status).toBe('ACTIVE');
    });
  });

  describe('Project Member Management', () => {
    /**
     * Requirement 4.1: Add member to project
     */
    it('should add member to project', () => {
      const manager = createUser('pm-manager', 'pm-manager@example.com', 'MANAGER');
      const member = createUser('pm-member', 'pm-member@example.com', 'MEMBER');
      createClient('client-pm', 'PM Client');
      createProject('project-pm', 'client-pm', manager.id, 'PM Project');

      addProjectMember('pm-1', 'project-pm', member.id, 'MEMBER');

      const members = db.all(sql`SELECT * FROM project_members WHERE project_id = ${'project-pm'}`);
      expect(members.length).toBe(1);
      expect((members[0] as { user_id: string }).user_id).toBe(member.id);
    });

    /**
     * Requirement 4.1: Check project membership
     */
    it('should verify project membership', async () => {
      const manager = createUser('pm2-manager', 'pm2-manager@example.com', 'MANAGER');
      const member = createUser('pm2-member', 'pm2-member@example.com', 'MEMBER');
      const nonMember = createUser('pm2-nonmember', 'pm2-nonmember@example.com', 'MEMBER');
      createClient('client-pm2', 'PM2 Client');
      createProject('project-pm2', 'client-pm2', manager.id, 'PM2 Project');
      addProjectMember('pm2-1', 'project-pm2', member.id, 'MEMBER');

      expect(await isProjectMember(member.id, 'project-pm2')).toBe(true);
      expect(await isProjectMember(nonMember.id, 'project-pm2')).toBe(false);
    });
  });

  describe('Task CRUD Operations', () => {
    /**
     * Requirement 5.1: Create task
     */
    it('should create task in project', () => {
      const manager = createUser('task-manager', 'task-manager@example.com', 'MANAGER');
      createClient('client-task', 'Task Client');
      createProject('project-task', 'client-task', manager.id, 'Task Project');

      const task = createTask('task-1', 'project-task', manager.id, 'New Task');

      const tasks = db.all(sql`SELECT * FROM tasks WHERE id = ${task.id}`);
      expect(tasks.length).toBe(1);
      expect((tasks[0] as { title: string }).title).toBe('New Task');
    });

    /**
     * Requirement 5.1: Read task
     */
    it('should read task with project association', () => {
      const manager = createUser('task2-manager', 'task2-manager@example.com', 'MANAGER');
      createClient('client-task2', 'Task2 Client');
      createProject('project-task2', 'client-task2', manager.id, 'Task2 Project');
      createTask('task-2', 'project-task2', manager.id, 'Task Two', 'TODO');

      const tasks = db.all(sql`
        SELECT t.*, p.name as project_name 
        FROM tasks t 
        JOIN projects p ON t.project_id = p.id 
        WHERE t.id = ${'task-2'}
      `);
      expect(tasks.length).toBe(1);
      const t = tasks[0] as { title: string; project_name: string; status: string };
      expect(t.title).toBe('Task Two');
      expect(t.project_name).toBe('Task2 Project');
      expect(t.status).toBe('TODO');
    });

    /**
     * Requirement 5.1: Update task status (Kanban move)
     */
    it('should update task status for Kanban movement', () => {
      const manager = createUser('task3-manager', 'task3-manager@example.com', 'MANAGER');
      createClient('client-task3', 'Task3 Client');
      createProject('project-task3', 'client-task3', manager.id, 'Task3 Project');
      createTask('task-3', 'project-task3', manager.id, 'Task Three', 'BACKLOG');

      // Move through Kanban columns
      const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
      for (const status of statuses) {
        db.run(sql`UPDATE tasks SET status = ${status} WHERE id = ${'task-3'}`);
        const tasks = db.all(sql`SELECT status FROM tasks WHERE id = ${'task-3'}`);
        expect((tasks[0] as { status: string }).status).toBe(status);
      }
    });

    /**
     * Requirement 5.1: Assign task to user
     */
    it('should assign task to project member', () => {
      const manager = createUser('task4-manager', 'task4-manager@example.com', 'MANAGER');
      const assignee = createUser('task4-assignee', 'task4-assignee@example.com', 'MEMBER');
      createClient('client-task4', 'Task4 Client');
      createProject('project-task4', 'client-task4', manager.id, 'Task4 Project');
      addProjectMember('pm-task4', 'project-task4', assignee.id, 'MEMBER');
      createTask('task-4', 'project-task4', manager.id, 'Task Four', 'TODO');

      db.run(sql`UPDATE tasks SET assignee_id = ${assignee.id} WHERE id = ${'task-4'}`);

      const tasks = db.all(sql`SELECT * FROM tasks WHERE id = ${'task-4'}`);
      expect((tasks[0] as { assignee_id: string }).assignee_id).toBe(assignee.id);
    });
  });

  describe('Permission Verification', () => {
    /**
     * Requirement 25.6: SUPER_ADMIN can access all projects
     */
    it('should allow SUPER_ADMIN to access any project', async () => {
      const superAdmin = createUser('super-admin', 'super@example.com', 'SUPER_ADMIN');
      const manager = createUser('perm-manager', 'perm-manager@example.com', 'MANAGER');
      createClient('client-perm', 'Perm Client');
      createProject('project-perm', 'client-perm', manager.id, 'Perm Project');

      const user: PermissionUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      expect(await canAccessProject(user, 'project-perm')).toBe(true);
      expect(await canManageProject(user, 'project-perm')).toBe(true);
    });

    /**
     * Requirement 25.6: ADMIN can access all projects
     */
    it('should allow ADMIN to access any project', async () => {
      const admin = createUser('admin-user', 'admin@example.com', 'ADMIN');
      const manager = createUser('perm2-manager', 'perm2-manager@example.com', 'MANAGER');
      createClient('client-perm2', 'Perm2 Client');
      createProject('project-perm2', 'client-perm2', manager.id, 'Perm2 Project');

      const user: PermissionUser = { id: admin.id, role: 'ADMIN' };
      expect(await canAccessProject(user, 'project-perm2')).toBe(true);
      expect(await canManageProject(user, 'project-perm2')).toBe(true);
    });

    /**
     * Requirement 25.6: MANAGER can only access assigned projects
     */
    it('should restrict MANAGER to assigned projects', async () => {
      const manager1 = createUser('manager-a', 'manager-a@example.com', 'MANAGER');
      const manager2 = createUser('manager-b', 'manager-b@example.com', 'MANAGER');
      createClient('client-perm3', 'Perm3 Client');
      createProject('project-perm3', 'client-perm3', manager1.id, 'Perm3 Project');

      const user1: PermissionUser = { id: manager1.id, role: 'MANAGER' };
      const user2: PermissionUser = { id: manager2.id, role: 'MANAGER' };

      // Manager1 is the project manager
      expect(await canAccessProject(user1, 'project-perm3')).toBe(true);
      expect(await canManageProject(user1, 'project-perm3')).toBe(true);

      // Manager2 is not assigned
      expect(await canAccessProject(user2, 'project-perm3')).toBe(false);
      expect(await canManageProject(user2, 'project-perm3')).toBe(false);
    });

    /**
     * Requirement 25.6: MEMBER can only access projects they're members of
     */
    it('should restrict MEMBER to projects they belong to', async () => {
      const manager = createUser('perm4-manager', 'perm4-manager@example.com', 'MANAGER');
      const member = createUser('perm4-member', 'perm4-member@example.com', 'MEMBER');
      const nonMember = createUser('perm4-nonmember', 'perm4-nonmember@example.com', 'MEMBER');
      createClient('client-perm4', 'Perm4 Client');
      createProject('project-perm4', 'client-perm4', manager.id, 'Perm4 Project');
      addProjectMember('pm-perm4', 'project-perm4', member.id, 'MEMBER');

      const memberUser: PermissionUser = { id: member.id, role: 'MEMBER' };
      const nonMemberUser: PermissionUser = { id: nonMember.id, role: 'MEMBER' };

      expect(await canAccessProject(memberUser, 'project-perm4')).toBe(true);
      expect(await canAccessProject(nonMemberUser, 'project-perm4')).toBe(false);
    });

    /**
     * Requirement 25.6: Task creation permission
     */
    it('should verify task creation permissions', async () => {
      const manager = createUser('perm5-manager', 'perm5-manager@example.com', 'MANAGER');
      const member = createUser('perm5-member', 'perm5-member@example.com', 'MEMBER');
      const guest = createUser('perm5-guest', 'perm5-guest@example.com', 'GUEST');
      createClient('client-perm5', 'Perm5 Client');
      createProject('project-perm5', 'client-perm5', manager.id, 'Perm5 Project');
      addProjectMember('pm-perm5', 'project-perm5', member.id, 'MEMBER');
      addProjectMember('pm-perm5-guest', 'project-perm5', guest.id, 'VIEWER');

      const managerUser: PermissionUser = { id: manager.id, role: 'MANAGER' };
      const memberUser: PermissionUser = { id: member.id, role: 'MEMBER' };
      const guestUser: PermissionUser = { id: guest.id, role: 'GUEST' };

      expect(await canCreateTask(managerUser, 'project-perm5')).toBe(true);
      expect(await canCreateTask(memberUser, 'project-perm5')).toBe(true);
      expect(await canCreateTask(guestUser, 'project-perm5')).toBe(false);
    });

    /**
     * Requirement 25.6: Task edit permission
     */
    it('should verify task edit permissions', async () => {
      const manager = createUser('perm6-manager', 'perm6-manager@example.com', 'MANAGER');
      const member = createUser('perm6-member', 'perm6-member@example.com', 'MEMBER');
      createClient('client-perm6', 'Perm6 Client');
      createProject('project-perm6', 'client-perm6', manager.id, 'Perm6 Project');
      addProjectMember('pm-perm6', 'project-perm6', member.id, 'MEMBER');

      const managerUser: PermissionUser = { id: manager.id, role: 'MANAGER' };
      const memberUser: PermissionUser = { id: member.id, role: 'MEMBER' };

      expect(await canEditTask(managerUser, 'project-perm6')).toBe(true);
      expect(await canEditTask(memberUser, 'project-perm6')).toBe(true);
    });
  });

  describe('Complete Workflow', () => {
    /**
     * Requirement 25.6: Full workflow - Create client -> Project -> Add member -> Create task -> Move task
     */
    it('should complete full client-project-task workflow', async () => {
      // Step 1: Create users
      const admin = createUser('wf-admin', 'wf-admin@example.com', 'ADMIN');
      const manager = createUser('wf-manager', 'wf-manager@example.com', 'MANAGER');
      const member = createUser('wf-member', 'wf-member@example.com', 'MEMBER');

      // Step 2: Create client
      const client = createClient('wf-client', 'Workflow Client', 'ACTIVE');
      const clients = db.all(sql`SELECT * FROM clients WHERE id = ${client.id}`);
      expect(clients.length).toBe(1);

      // Step 3: Create project
      const project = createProject('wf-project', client.id, manager.id, 'Workflow Project', 'ACTIVE');
      const projects = db.all(sql`SELECT * FROM projects WHERE id = ${project.id}`);
      expect(projects.length).toBe(1);

      // Step 4: Add member to project
      addProjectMember('wf-pm', project.id, member.id, 'MEMBER');
      expect(await isProjectMember(member.id, project.id)).toBe(true);

      // Step 5: Verify permissions
      const adminUser: PermissionUser = { id: admin.id, role: 'ADMIN' };
      const managerUser: PermissionUser = { id: manager.id, role: 'MANAGER' };
      const memberUser: PermissionUser = { id: member.id, role: 'MEMBER' };

      expect(await canAccessProject(adminUser, project.id)).toBe(true);
      expect(await canAccessProject(managerUser, project.id)).toBe(true);
      expect(await canAccessProject(memberUser, project.id)).toBe(true);

      // Step 6: Create task
      const task = createTask('wf-task', project.id, manager.id, 'Workflow Task', 'BACKLOG');
      const tasks = db.all(sql`SELECT * FROM tasks WHERE id = ${task.id}`);
      expect(tasks.length).toBe(1);

      // Step 7: Assign task to member
      db.run(sql`UPDATE tasks SET assignee_id = ${member.id} WHERE id = ${task.id}`);
      const updatedTasks = db.all(sql`SELECT * FROM tasks WHERE id = ${task.id}`);
      expect((updatedTasks[0] as { assignee_id: string }).assignee_id).toBe(member.id);

      // Step 8: Move task through Kanban
      db.run(sql`UPDATE tasks SET status = ${'TODO'} WHERE id = ${task.id}`);
      db.run(sql`UPDATE tasks SET status = ${'IN_PROGRESS'} WHERE id = ${task.id}`);
      db.run(sql`UPDATE tasks SET status = ${'DONE'} WHERE id = ${task.id}`);

      const finalTasks = db.all(sql`SELECT * FROM tasks WHERE id = ${task.id}`);
      expect((finalTasks[0] as { status: string }).status).toBe('DONE');

      // Step 9: Verify all entities are correctly associated
      const fullQuery = db.all(sql`
        SELECT 
          t.id as task_id, t.title, t.status,
          p.id as project_id, p.name as project_name,
          c.id as client_id, c.name as client_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        WHERE t.id = ${task.id}
      `);

      expect(fullQuery.length).toBe(1);
      const result = fullQuery[0] as {
        task_id: string;
        title: string;
        status: string;
        project_id: string;
        project_name: string;
        client_id: string;
        client_name: string;
      };
      expect(result.task_id).toBe(task.id);
      expect(result.project_id).toBe(project.id);
      expect(result.client_id).toBe(client.id);
      expect(result.status).toBe('DONE');
    });
  });
});
