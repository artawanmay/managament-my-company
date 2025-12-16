/**
 * Property-based tests for comments system
 * Tests for comment notification creation
 */
import { describe, it, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema/index';

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

  // Create tasks table
  sqlite.exec(`
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
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create comments table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      mentions TEXT,
      attachments TEXT,
      is_edited INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create notifications table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      read_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create indexes
  sqlite.exec(`CREATE INDEX IF NOT EXISTS comments_task_id_idx ON comments(task_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS comments_user_id_idx ON comments(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx ON tasks(assignee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tasks_reporter_id_idx ON tasks(reporter_id)`);
}

function cleanupTestDb() {
  if (sqlite) {
    sqlite.close();
  }
}

// UUID generator for test IDs
const uuidArbitrary = fc.uuid();

// Role arbitrary (excluding GUEST for comment creation)
const roleArbitrary = fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER') as fc.Arbitrary<
  'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'MEMBER'
>;

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

/**
 * Helper function to create notifications for a comment
 * This simulates the notification creation logic from the API route
 */
function createCommentNotifications(
  commentId: string,
  commentAuthorId: string,
  commentAuthorName: string,
  taskId: string,
  taskTitle: string,
  projectId: string,
  assigneeId: string | null,
  reporterId: string,
  mentionedUserIds: string[]
): Array<{
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: string;
}> {
  const notifications: Array<{
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data: string;
  }> = [];
  const notifiedUserIds = new Set<string>();

  // Notify mentioned users (Requirement 8.2)
  for (const mentionedUserId of mentionedUserIds) {
    if (mentionedUserId !== commentAuthorId && !notifiedUserIds.has(mentionedUserId)) {
      notifications.push({
        id: `notif-mention-${mentionedUserId}-${commentId}`,
        userId: mentionedUserId,
        type: 'MENTIONED',
        title: 'You were mentioned in a comment',
        message: `${commentAuthorName} mentioned you in a comment on task: ${taskTitle}`,
        data: JSON.stringify({
          entityType: 'COMMENT',
          entityId: commentId,
          taskId,
          projectId,
          commentAuthor: commentAuthorId,
        }),
      });
      notifiedUserIds.add(mentionedUserId);
    }
  }

  // Notify task assignee if not the comment author (Requirement 8.3)
  if (assigneeId && assigneeId !== commentAuthorId && !notifiedUserIds.has(assigneeId)) {
    notifications.push({
      id: `notif-assignee-${assigneeId}-${commentId}`,
      userId: assigneeId,
      type: 'COMMENT_ADDED',
      title: 'New comment on your task',
      message: `${commentAuthorName} commented on task: ${taskTitle}`,
      data: JSON.stringify({
        entityType: 'COMMENT',
        entityId: commentId,
        taskId,
        projectId,
        commentAuthor: commentAuthorId,
      }),
    });
    notifiedUserIds.add(assigneeId);
  }

  // Notify task reporter if not the comment author (Requirement 8.3)
  if (reporterId !== commentAuthorId && !notifiedUserIds.has(reporterId)) {
    notifications.push({
      id: `notif-reporter-${reporterId}-${commentId}`,
      userId: reporterId,
      type: 'COMMENT_ADDED',
      title: 'New comment on a task you reported',
      message: `${commentAuthorName} commented on task: ${taskTitle}`,
      data: JSON.stringify({
        entityType: 'COMMENT',
        entityId: commentId,
        taskId,
        projectId,
        commentAuthor: commentAuthorId,
      }),
    });
    notifiedUserIds.add(reporterId);
  }

  return notifications;
}

describe('Comments Properties', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * **Feature: mmc-app, Property 20: Comment Notification Creation**
   * *For any* comment created on a task, notifications should be created for
   * the task assignee, reporter, and mentioned users (excluding the comment author).
   * **Validates: Requirements 8.2, 8.3**
   */
  it(
    'Property 20: Comment Notification Creation - assignee and reporter receive notifications',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // commentAuthorId
          uuidArbitrary, // assigneeId
          uuidArbitrary, // reporterId
          uuidArbitrary, // taskId
          uuidArbitrary, // projectId
          uuidArbitrary, // commentId
          fc.string({ minLength: 1, maxLength: 100 }), // taskTitle
          fc.string({ minLength: 1, maxLength: 500 }), // commentMessage
          roleArbitrary, // authorRole
          async (
            commentAuthorId,
            assigneeId,
            reporterId,
            taskId,
            projectId,
            commentId,
            taskTitle,
            commentMessage,
            authorRole
          ) => {
            // Ensure all user IDs are different
            if (
              commentAuthorId === assigneeId ||
              commentAuthorId === reporterId ||
              assigneeId === reporterId
            ) {
              return true; // Skip this case - we need distinct users
            }

            // Create users
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${commentAuthorId}, ${`author-${commentAuthorId}@example.com`}, 'hash', 'Comment Author', ${authorRole})
            `);
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${assigneeId}, ${`assignee-${assigneeId}@example.com`}, 'hash', 'Task Assignee', 'MEMBER')
            `);
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${reporterId}, ${`reporter-${reporterId}@example.com`}, 'hash', 'Task Reporter', 'MEMBER')
            `);

            // Create project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${commentAuthorId})
            `);

            // Create task
            db.run(sql`
              INSERT INTO tasks (id, project_id, title, assignee_id, reporter_id)
              VALUES (${taskId}, ${projectId}, ${taskTitle}, ${assigneeId}, ${reporterId})
            `);

            // Create comment
            db.run(sql`
              INSERT INTO comments (id, task_id, user_id, message)
              VALUES (${commentId}, ${taskId}, ${commentAuthorId}, ${commentMessage})
            `);

            // Create notifications using the helper function
            const notifications = createCommentNotifications(
              commentId,
              commentAuthorId,
              'Comment Author',
              taskId,
              taskTitle,
              projectId,
              assigneeId,
              reporterId,
              [] // No mentions
            );

            // Insert notifications
            for (const notif of notifications) {
              db.run(sql`
                INSERT INTO notifications (id, user_id, type, title, message, data)
                VALUES (${notif.id}, ${notif.userId}, ${notif.type}, ${notif.title}, ${notif.message}, ${notif.data})
              `);
            }

            // Verify notifications were created for assignee and reporter
            const assigneeNotifs = db.all(sql`
              SELECT * FROM notifications WHERE user_id = ${assigneeId}
            `) as Array<{ user_id: string; type: string }>;

            const reporterNotifs = db.all(sql`
              SELECT * FROM notifications WHERE user_id = ${reporterId}
            `) as Array<{ user_id: string; type: string }>;

            // Both assignee and reporter should have notifications
            const assigneeHasNotif = assigneeNotifs.length > 0;
            const reporterHasNotif = reporterNotifs.length > 0;

            // Comment author should NOT have notifications
            const authorNotifs = db.all(sql`
              SELECT * FROM notifications WHERE user_id = ${commentAuthorId}
            `) as Array<{ user_id: string }>;
            const authorHasNoNotif = authorNotifs.length === 0;

            return assigneeHasNotif && reporterHasNotif && authorHasNoNotif;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 20: Comment Notification Creation**
   * Mentioned users receive MENTIONED notifications.
   * **Validates: Requirements 8.2, 8.3**
   */
  it(
    'Property 20: Comment Notification Creation - mentioned users receive notifications',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // commentAuthorId
          uuidArbitrary, // mentionedUserId
          uuidArbitrary, // taskId
          uuidArbitrary, // projectId
          uuidArbitrary, // commentId
          fc.string({ minLength: 1, maxLength: 100 }), // taskTitle
          roleArbitrary, // authorRole
          async (
            commentAuthorId,
            mentionedUserId,
            taskId,
            projectId,
            commentId,
            taskTitle,
            authorRole
          ) => {
            // Ensure user IDs are different
            if (commentAuthorId === mentionedUserId) {
              return true; // Skip - author cannot mention themselves for notification
            }

            // Create users
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${commentAuthorId}, ${`author-${commentAuthorId}@example.com`}, 'hash', 'Comment Author', ${authorRole})
            `);
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${mentionedUserId}, ${`mentioned-${mentionedUserId}@example.com`}, 'hash', 'Mentioned User', 'MEMBER')
            `);

            // Create project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${commentAuthorId})
            `);

            // Create task (author is both assignee and reporter to isolate mention test)
            db.run(sql`
              INSERT INTO tasks (id, project_id, title, assignee_id, reporter_id)
              VALUES (${taskId}, ${projectId}, ${taskTitle}, ${commentAuthorId}, ${commentAuthorId})
            `);

            // Create comment with mention
            const commentMessage = `Hey @MentionedUser check this out`;
            db.run(sql`
              INSERT INTO comments (id, task_id, user_id, message, mentions)
              VALUES (${commentId}, ${taskId}, ${commentAuthorId}, ${commentMessage}, ${JSON.stringify([mentionedUserId])})
            `);

            // Create notifications using the helper function
            const notifications = createCommentNotifications(
              commentId,
              commentAuthorId,
              'Comment Author',
              taskId,
              taskTitle,
              projectId,
              commentAuthorId, // Author is assignee
              commentAuthorId, // Author is reporter
              [mentionedUserId] // Mentioned user
            );

            // Insert notifications
            for (const notif of notifications) {
              db.run(sql`
                INSERT INTO notifications (id, user_id, type, title, message, data)
                VALUES (${notif.id}, ${notif.userId}, ${notif.type}, ${notif.title}, ${notif.message}, ${notif.data})
              `);
            }

            // Verify mentioned user received a MENTIONED notification
            const mentionedNotifs = db.all(sql`
              SELECT * FROM notifications WHERE user_id = ${mentionedUserId} AND type = 'MENTIONED'
            `) as Array<{ user_id: string; type: string }>;

            return mentionedNotifs.length === 1;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 20: Comment Notification Creation**
   * Comment author should never receive a notification for their own comment.
   * **Validates: Requirements 8.2, 8.3**
   */
  it(
    'Property 20: Comment Notification Creation - author does not receive self-notification',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // commentAuthorId (also assignee and reporter)
          uuidArbitrary, // taskId
          uuidArbitrary, // projectId
          uuidArbitrary, // commentId
          fc.string({ minLength: 1, maxLength: 100 }), // taskTitle
          fc.string({ minLength: 1, maxLength: 500 }), // commentMessage
          roleArbitrary, // authorRole
          async (
            commentAuthorId,
            taskId,
            projectId,
            commentId,
            taskTitle,
            commentMessage,
            authorRole
          ) => {
            // Create user (author is also assignee and reporter)
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${commentAuthorId}, ${`author-${commentAuthorId}@example.com`}, 'hash', 'Comment Author', ${authorRole})
            `);

            // Create project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${commentAuthorId})
            `);

            // Create task where author is both assignee and reporter
            db.run(sql`
              INSERT INTO tasks (id, project_id, title, assignee_id, reporter_id)
              VALUES (${taskId}, ${projectId}, ${taskTitle}, ${commentAuthorId}, ${commentAuthorId})
            `);

            // Create comment
            db.run(sql`
              INSERT INTO comments (id, task_id, user_id, message)
              VALUES (${commentId}, ${taskId}, ${commentAuthorId}, ${commentMessage})
            `);

            // Create notifications using the helper function
            // Author is assignee, reporter, and mentions themselves
            const notifications = createCommentNotifications(
              commentId,
              commentAuthorId,
              'Comment Author',
              taskId,
              taskTitle,
              projectId,
              commentAuthorId, // Author is assignee
              commentAuthorId, // Author is reporter
              [commentAuthorId] // Author mentions themselves
            );

            // Insert notifications
            for (const notif of notifications) {
              db.run(sql`
                INSERT INTO notifications (id, user_id, type, title, message, data)
                VALUES (${notif.id}, ${notif.userId}, ${notif.type}, ${notif.title}, ${notif.message}, ${notif.data})
              `);
            }

            // Verify author did NOT receive any notifications
            const authorNotifs = db.all(sql`
              SELECT * FROM notifications WHERE user_id = ${commentAuthorId}
            `) as Array<{ user_id: string }>;

            return authorNotifs.length === 0;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 20: Comment Notification Creation**
   * Each user should receive at most one notification per comment (no duplicates).
   * **Validates: Requirements 8.2, 8.3**
   */
  it(
    'Property 20: Comment Notification Creation - no duplicate notifications per user',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // commentAuthorId
          uuidArbitrary, // userId (assignee, reporter, and mentioned)
          uuidArbitrary, // taskId
          uuidArbitrary, // projectId
          uuidArbitrary, // commentId
          fc.string({ minLength: 1, maxLength: 100 }), // taskTitle
          roleArbitrary, // authorRole
          async (
            commentAuthorId,
            userId,
            taskId,
            projectId,
            commentId,
            taskTitle,
            authorRole
          ) => {
            // Ensure user IDs are different
            if (commentAuthorId === userId) {
              return true; // Skip - need different users
            }

            // Create users
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${commentAuthorId}, ${`author-${commentAuthorId}@example.com`}, 'hash', 'Comment Author', ${authorRole})
            `);
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${userId}, ${`user-${userId}@example.com`}, 'hash', 'Test User', 'MEMBER')
            `);

            // Create project
            db.run(sql`
              INSERT INTO projects (id, name, manager_id)
              VALUES (${projectId}, 'Test Project', ${commentAuthorId})
            `);

            // Create task where userId is BOTH assignee AND reporter
            db.run(sql`
              INSERT INTO tasks (id, project_id, title, assignee_id, reporter_id)
              VALUES (${taskId}, ${projectId}, ${taskTitle}, ${userId}, ${userId})
            `);

            // Create comment that also mentions the same user
            const commentMessage = `Hey @TestUser check this out`;
            db.run(sql`
              INSERT INTO comments (id, task_id, user_id, message, mentions)
              VALUES (${commentId}, ${taskId}, ${commentAuthorId}, ${commentMessage}, ${JSON.stringify([userId])})
            `);

            // Create notifications using the helper function
            // userId is assignee, reporter, AND mentioned - should only get ONE notification
            const notifications = createCommentNotifications(
              commentId,
              commentAuthorId,
              'Comment Author',
              taskId,
              taskTitle,
              projectId,
              userId, // User is assignee
              userId, // User is reporter
              [userId] // User is also mentioned
            );

            // Insert notifications
            for (const notif of notifications) {
              db.run(sql`
                INSERT INTO notifications (id, user_id, type, title, message, data)
                VALUES (${notif.id}, ${notif.userId}, ${notif.type}, ${notif.title}, ${notif.message}, ${notif.data})
              `);
            }

            // Verify user received exactly ONE notification (no duplicates)
            const userNotifs = db.all(sql`
              SELECT * FROM notifications WHERE user_id = ${userId}
            `) as Array<{ user_id: string }>;

            // Should have exactly 1 notification despite being assignee, reporter, and mentioned
            return userNotifs.length === 1;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
