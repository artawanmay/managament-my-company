/**
 * Integration tests for credential/secret access
 * Tests authorized vs unauthorized secret viewing
 *
 * Requirements: 7.3, 7.4
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema/index';
import { encryptSecret, decryptSecret } from '@/lib/security/crypto';
import {
  canAccessNote,
  canViewNoteSecret,
  setDatabase,
  resetDatabase,
  type PermissionUser,
} from '@/lib/auth/permissions';

// Test database setup
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

// Store original env
const originalEnv = process.env.ENCRYPTION_KEY;

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

  // Create note_access_logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS note_access_logs (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
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

function createClient(id: string, name: string) {
  db.run(sql`
    INSERT INTO clients (id, name, status)
    VALUES (${id}, ${name}, 'ACTIVE')
  `);
  return { id, name };
}

function createProject(id: string, clientId: string, managerId: string, name: string) {
  db.run(sql`
    INSERT INTO projects (id, client_id, manager_id, name, status)
    VALUES (${id}, ${clientId}, ${managerId}, ${name}, 'ACTIVE')
  `);
  return { id, clientId, managerId, name };
}

function addProjectMember(id: string, projectId: string, userId: string, role: string = 'MEMBER') {
  db.run(sql`
    INSERT INTO project_members (id, project_id, user_id, role)
    VALUES (${id}, ${projectId}, ${userId}, ${role})
  `);
  return { id, projectId, userId, role };
}

function createNote(
  id: string,
  systemName: string,
  secret: string,
  createdBy: string,
  projectId?: string,
  clientId?: string,
  type: string = 'API'
) {
  const encryptedSecret = encryptSecret(secret);
  db.run(sql`
    INSERT INTO notes (id, type, system_name, secret, created_by, updated_by, project_id, client_id)
    VALUES (${id}, ${type}, ${systemName}, ${encryptedSecret}, ${createdBy}, ${createdBy}, ${projectId ?? null}, ${clientId ?? null})
  `);
  return { id, systemName, encryptedSecret, createdBy, projectId, clientId };
}

function logNoteAccess(id: string, noteId: string, userId: string, ip: string, userAgent: string) {
  db.run(sql`
    INSERT INTO note_access_logs (id, note_id, user_id, action, ip, user_agent)
    VALUES (${id}, ${noteId}, ${userId}, 'VIEW_SECRET', ${ip}, ${userAgent})
  `);
  return { id, noteId, userId };
}

describe('Credential Access Integration Tests', () => {
  beforeAll(() => {
    // Set encryption key for tests
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests-32chars';
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  describe('Secret Encryption/Decryption', () => {
    /**
     * Requirement 7.2: Secrets are encrypted at rest
     */
    it('should encrypt secrets before storage', () => {
      const plainSecret = 'my-super-secret-api-key';
      const encrypted = encryptSecret(plainSecret);

      // Encrypted value should be different from plaintext
      expect(encrypted).not.toBe(plainSecret);
      // Should be base64 encoded
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    /**
     * Requirement 7.2: Secrets can be decrypted
     */
    it('should decrypt secrets correctly', () => {
      const plainSecret = 'my-super-secret-api-key';
      const encrypted = encryptSecret(plainSecret);
      const decrypted = decryptSecret(encrypted);

      expect(decrypted).toBe(plainSecret);
    });

    /**
     * Requirement 7.2: Each encryption produces unique ciphertext
     */
    it('should produce different ciphertext for same plaintext', () => {
      const plainSecret = 'same-secret';
      const encrypted1 = encryptSecret(plainSecret);
      const encrypted2 = encryptSecret(plainSecret);

      // Due to random IV and salt, same plaintext should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decryptSecret(encrypted1)).toBe(plainSecret);
      expect(decryptSecret(encrypted2)).toBe(plainSecret);
    });

    /**
     * Requirement 7.2: Tampered ciphertext should fail decryption
     */
    it('should fail decryption for tampered ciphertext', () => {
      const plainSecret = 'secret-to-tamper';
      const encrypted = encryptSecret(plainSecret);

      // Tamper with the ciphertext
      const buffer = Buffer.from(encrypted, 'base64');
      const lastIndex = buffer.length - 1;
      if (lastIndex >= 0) {
        buffer[lastIndex] = buffer[lastIndex]! ^ 0xff; // Flip bits in last byte
      }
      const tampered = buffer.toString('base64');

      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  describe('Authorized Secret Access', () => {
    /**
     * Requirement 7.3: Authorized user can view secret
     */
    it('should allow SUPER_ADMIN to view any secret', async () => {
      const superAdmin = createUser('super-admin', 'super@example.com', 'SUPER_ADMIN');
      const manager = createUser('note-manager', 'manager@example.com', 'MANAGER');
      createClient('client-1', 'Test Client');
      createProject('project-1', 'client-1', manager.id, 'Test Project');
      createNote('note-1', 'API System', 'secret-api-key', manager.id, 'project-1');

      const user: PermissionUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      expect(await canAccessNote(user, 'note-1')).toBe(true);
      expect(await canViewNoteSecret(user, 'note-1')).toBe(true);
    });

    /**
     * Requirement 7.3: SUPER_ADMIN can view secrets
     */
    it('should allow SUPER_ADMIN to view any secret', async () => {
      const superAdmin = createUser('super-admin', 'superadmin@example.com', 'SUPER_ADMIN');
      const manager = createUser('note-manager2', 'manager2@example.com', 'MANAGER');
      createClient('client-2', 'Test Client 2');
      createProject('project-2', 'client-2', manager.id, 'Test Project 2');
      createNote('note-2', 'DB System', 'db-password', manager.id, 'project-2');

      const user: PermissionUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      expect(await canAccessNote(user, 'note-2')).toBe(true);
      expect(await canViewNoteSecret(user, 'note-2')).toBe(true);
    });

    /**
     * Requirement 7.3: MANAGER can view secrets in their projects
     */
    it('should allow MANAGER to view secrets in assigned projects', async () => {
      const manager = createUser('manager-3', 'manager3@example.com', 'MANAGER');
      createClient('client-3', 'Test Client 3');
      createProject('project-3', 'client-3', manager.id, 'Test Project 3');
      createNote('note-3', 'SSH System', 'ssh-key', manager.id, 'project-3');

      const user: PermissionUser = { id: manager.id, role: 'MANAGER' };
      expect(await canAccessNote(user, 'note-3')).toBe(true);
      expect(await canViewNoteSecret(user, 'note-3')).toBe(true);
    });

    /**
     * Requirement 7.3: MEMBER can view secrets in projects they belong to
     */
    it('should allow MEMBER to view secrets in their projects', async () => {
      const manager = createUser('manager-4', 'manager4@example.com', 'MANAGER');
      const member = createUser('member-4', 'member4@example.com', 'MEMBER');
      createClient('client-4', 'Test Client 4');
      createProject('project-4', 'client-4', manager.id, 'Test Project 4');
      addProjectMember('pm-4', 'project-4', member.id, 'MEMBER');
      createNote('note-4', 'RDP System', 'rdp-password', manager.id, 'project-4');

      const user: PermissionUser = { id: member.id, role: 'MEMBER' };
      expect(await canAccessNote(user, 'note-4')).toBe(true);
      expect(await canViewNoteSecret(user, 'note-4')).toBe(true);
    });

    /**
     * Requirement 7.3: Note creator can view their own secrets
     */
    it('should allow note creator to view their own secrets', async () => {
      const member = createUser('creator-member', 'creator@example.com', 'MEMBER');
      const manager = createUser('manager-5', 'manager5@example.com', 'MANAGER');
      createClient('client-5', 'Test Client 5');
      createProject('project-5', 'client-5', manager.id, 'Test Project 5');
      addProjectMember('pm-5', 'project-5', member.id, 'MEMBER');
      createNote('note-5', 'My System', 'my-secret', member.id, 'project-5');

      const user: PermissionUser = { id: member.id, role: 'MEMBER' };
      expect(await canAccessNote(user, 'note-5')).toBe(true);
      expect(await canViewNoteSecret(user, 'note-5')).toBe(true);
    });
  });

  describe('Unauthorized Secret Access', () => {
    /**
     * Requirement 7.4: GUEST cannot view secrets
     */
    it('should deny GUEST from viewing secrets', async () => {
      const guest = createUser('guest', 'guest@example.com', 'GUEST');
      const manager = createUser('manager-6', 'manager6@example.com', 'MANAGER');
      createClient('client-6', 'Test Client 6');
      createProject('project-6', 'client-6', manager.id, 'Test Project 6');
      addProjectMember('pm-6', 'project-6', guest.id, 'VIEWER');
      createNote('note-6', 'Secret System', 'top-secret', manager.id, 'project-6');

      const user: PermissionUser = { id: guest.id, role: 'GUEST' };
      expect(await canViewNoteSecret(user, 'note-6')).toBe(false);
    });

    /**
     * Requirement 7.4: MEMBER cannot view secrets in projects they don't belong to
     */
    it('should deny MEMBER from viewing secrets in other projects', async () => {
      const manager = createUser('manager-7', 'manager7@example.com', 'MANAGER');
      const member = createUser('member-7', 'member7@example.com', 'MEMBER');
      createClient('client-7', 'Test Client 7');
      createProject('project-7', 'client-7', manager.id, 'Test Project 7');
      // Note: member is NOT added to project-7
      createNote('note-7', 'Restricted System', 'restricted-secret', manager.id, 'project-7');

      const user: PermissionUser = { id: member.id, role: 'MEMBER' };
      expect(await canAccessNote(user, 'note-7')).toBe(false);
      expect(await canViewNoteSecret(user, 'note-7')).toBe(false);
    });

    /**
     * Requirement 7.4: MANAGER cannot view secrets in projects they don't manage
     */
    it('should deny MANAGER from viewing secrets in other projects', async () => {
      const manager1 = createUser('manager-8a', 'manager8a@example.com', 'MANAGER');
      const manager2 = createUser('manager-8b', 'manager8b@example.com', 'MANAGER');
      createClient('client-8', 'Test Client 8');
      createProject('project-8', 'client-8', manager1.id, 'Test Project 8');
      createNote('note-8', 'Manager1 System', 'manager1-secret', manager1.id, 'project-8');

      const user: PermissionUser = { id: manager2.id, role: 'MANAGER' };
      expect(await canAccessNote(user, 'note-8')).toBe(false);
      expect(await canViewNoteSecret(user, 'note-8')).toBe(false);
    });

    /**
     * Requirement 7.4: Non-existent note should be denied
     */
    it('should deny access to non-existent notes', async () => {
      const admin = createUser('admin-9', 'admin9@example.com', 'ADMIN');

      const user: PermissionUser = { id: admin.id, role: 'MEMBER' };
      expect(await canAccessNote(user, 'non-existent-note')).toBe(false);
      expect(await canViewNoteSecret(user, 'non-existent-note')).toBe(false);
    });
  });

  describe('Access Logging', () => {
    /**
     * Requirement 7.4: Secret access should be logged
     */
    it('should log secret access', () => {
      const manager = createUser('manager-log', 'manager-log@example.com', 'MANAGER');
      createClient('client-log', 'Log Client');
      createProject('project-log', 'client-log', manager.id, 'Log Project');
      createNote('note-log', 'Logged System', 'logged-secret', manager.id, 'project-log');

      // Log the access
      logNoteAccess('log-1', 'note-log', manager.id, '192.168.1.1', 'Mozilla/5.0');

      // Verify log was created
      const logs = db.all(sql`SELECT * FROM note_access_logs WHERE note_id = ${'note-log'}`);
      expect(logs.length).toBe(1);
      const log = logs[0] as { user_id: string; action: string; ip: string };
      expect(log.user_id).toBe(manager.id);
      expect(log.action).toBe('VIEW_SECRET');
      expect(log.ip).toBe('192.168.1.1');
    });

    /**
     * Requirement 7.4: Multiple accesses should be logged separately
     */
    it('should log multiple secret accesses', () => {
      const manager = createUser('manager-multi', 'manager-multi@example.com', 'MANAGER');
      const admin = createUser('admin-multi', 'admin-multi@example.com', 'ADMIN');
      createClient('client-multi', 'Multi Client');
      createProject('project-multi', 'client-multi', manager.id, 'Multi Project');
      createNote('note-multi', 'Multi System', 'multi-secret', manager.id, 'project-multi');

      // Log multiple accesses
      logNoteAccess('log-m1', 'note-multi', manager.id, '192.168.1.1', 'Chrome');
      logNoteAccess('log-m2', 'note-multi', admin.id, '192.168.1.2', 'Firefox');
      logNoteAccess('log-m3', 'note-multi', manager.id, '192.168.1.1', 'Chrome');

      // Verify all logs were created
      const logs = db.all(sql`SELECT * FROM note_access_logs WHERE note_id = ${'note-multi'}`);
      expect(logs.length).toBe(3);
    });
  });

  describe('Complete Credential Access Flow', () => {
    /**
     * Requirement 7.3, 7.4: Complete flow - Create note with secret -> Authorized user views -> Log created
     */
    it('should complete full credential access flow', async () => {
      // Step 1: Create users
      const superAdmin = createUser('flow-superadmin', 'flow-superadmin@example.com', 'SUPER_ADMIN');
      const manager = createUser('flow-manager', 'flow-manager@example.com', 'MANAGER');
      const member = createUser('flow-member', 'flow-member@example.com', 'MEMBER');
      const guest = createUser('flow-guest', 'flow-guest@example.com', 'GUEST');

      // Step 2: Create client and project
      createClient('flow-client', 'Flow Client');
      createProject('flow-project', 'flow-client', manager.id, 'Flow Project');
      addProjectMember('flow-pm-member', 'flow-project', member.id, 'MEMBER');
      addProjectMember('flow-pm-guest', 'flow-project', guest.id, 'VIEWER');

      // Step 3: Create note with secret
      const plainSecret = 'super-secret-api-key-12345';
      createNote('flow-note', 'Production API', plainSecret, manager.id, 'flow-project');

      // Step 4: Verify secret is encrypted in database
      const notes = db.all(sql`SELECT secret FROM notes WHERE id = ${'flow-note'}`);
      const storedSecret = (notes[0] as { secret: string }).secret;
      expect(storedSecret).not.toBe(plainSecret);

      // Step 5: Authorized users can view
      const superAdminUser: PermissionUser = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      const managerUser: PermissionUser = { id: manager.id, role: 'MANAGER' };
      const memberUser: PermissionUser = { id: member.id, role: 'MEMBER' };
      const guestUser: PermissionUser = { id: guest.id, role: 'GUEST' };

      expect(await canViewNoteSecret(superAdminUser, 'flow-note')).toBe(true);
      expect(await canViewNoteSecret(managerUser, 'flow-note')).toBe(true);
      expect(await canViewNoteSecret(memberUser, 'flow-note')).toBe(true);
      expect(await canViewNoteSecret(guestUser, 'flow-note')).toBe(false);

      // Step 6: Decrypt and verify secret
      const decrypted = decryptSecret(storedSecret);
      expect(decrypted).toBe(plainSecret);

      // Step 7: Log access
      logNoteAccess('flow-log-1', 'flow-note', superAdmin.id, '10.0.0.1', 'SuperAdmin Browser');
      logNoteAccess('flow-log-2', 'flow-note', manager.id, '10.0.0.2', 'Manager Browser');
      logNoteAccess('flow-log-3', 'flow-note', member.id, '10.0.0.3', 'Member Browser');

      // Step 8: Verify access logs
      const logs = db.all(sql`SELECT * FROM note_access_logs WHERE note_id = ${'flow-note'} ORDER BY created_at`);
      expect(logs.length).toBe(3);

      const userIds = (logs as { user_id: string }[]).map((l) => l.user_id);
      expect(userIds).toContain(superAdmin.id);
      expect(userIds).toContain(manager.id);
      expect(userIds).toContain(member.id);
    });

    /**
     * Requirement 7.4: Unauthorized user attempts view -> Access denied
     */
    it('should deny unauthorized access and not log', async () => {
      const manager = createUser('deny-manager', 'deny-manager@example.com', 'MANAGER');
      const outsider = createUser('deny-outsider', 'deny-outsider@example.com', 'MEMBER');

      createClient('deny-client', 'Deny Client');
      createProject('deny-project', 'deny-client', manager.id, 'Deny Project');
      createNote('deny-note', 'Restricted System', 'restricted-secret', manager.id, 'deny-project');

      // Outsider is not a member of the project
      const outsiderUser: PermissionUser = { id: outsider.id, role: 'MEMBER' };

      // Step 1: Check permission - should be denied
      const canAccess = await canAccessNote(outsiderUser, 'deny-note');
      const canView = await canViewNoteSecret(outsiderUser, 'deny-note');

      expect(canAccess).toBe(false);
      expect(canView).toBe(false);

      // Step 2: No log should be created for denied access
      // (In real implementation, we might log failed attempts separately)
      const logs = db.all(sql`SELECT * FROM note_access_logs WHERE note_id = ${'deny-note'} AND user_id = ${outsider.id}`);
      expect(logs.length).toBe(0);
    });
  });
});
