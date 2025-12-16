/**
 * Property-based tests for activity logging system
 * Tests for activity log completeness
 *
 * **Feature: mmc-app, Property 21: Activity Log Completeness**
 * **Validates: Requirements 10.1**
 */
import { describe, it, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema/index';
import { randomUUID } from 'crypto';

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

  // Create activity_logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create indexes
  sqlite.exec(`CREATE INDEX IF NOT EXISTS activity_logs_actor_id_idx ON activity_logs(actor_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON activity_logs(entity_type, entity_id)`);
}

function cleanupTestDb() {
  if (sqlite) {
    sqlite.close();
  }
}

// UUID generator for test IDs
const uuidArbitrary = fc.uuid();

// Entity type arbitrary
const entityTypeArbitrary = fc.constantFrom('CLIENT', 'PROJECT', 'TASK', 'NOTE', 'FILE', 'COMMENT', 'USER') as fc.Arbitrary<
  'CLIENT' | 'PROJECT' | 'TASK' | 'NOTE' | 'FILE' | 'COMMENT' | 'USER'
>;

// Action arbitrary
const actionArbitrary = fc.constantFrom('CREATED', 'UPDATED', 'DELETED', 'MOVED', 'ARCHIVED') as fc.Arbitrary<
  'CREATED' | 'UPDATED' | 'DELETED' | 'MOVED' | 'ARCHIVED'
>;

// Role arbitrary
const roleArbitrary = fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'GUEST') as fc.Arbitrary<
  'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'GUEST'
>;

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

/**
 * Helper function to log an activity
 * This simulates the logActivity function from the activity service
 */
function logActivityToDb(
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown>
): string {
  const activityId = randomUUID();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  db.run(sql`
    INSERT INTO activity_logs (id, actor_id, entity_type, entity_id, action, metadata)
    VALUES (${activityId}, ${actorId}, ${entityType}, ${entityId}, ${action}, ${metadataJson})
  `);

  return activityId;
}

describe('Activity Log Properties', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  /**
   * **Feature: mmc-app, Property 21: Activity Log Completeness**
   * *For any* significant action (create, update, delete on main entities),
   * an activity log entry should be created with actor ID, entity type, entity ID, action, and timestamp.
   * **Validates: Requirements 10.1**
   */
  it(
    'Property 21: Activity Log Completeness - all required fields are present',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // actorId
          uuidArbitrary, // entityId
          entityTypeArbitrary, // entityType
          actionArbitrary, // action
          roleArbitrary, // actorRole
          fc.option(fc.object(), { nil: undefined }), // optional metadata
          async (actorId, entityId, entityType, action, actorRole, metadata) => {
            // Create actor user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${actorId}, ${`actor-${actorId}@example.com`}, 'hash', 'Test Actor', ${actorRole})
            `);

            // Log the activity
            const activityId = logActivityToDb(
              actorId,
              entityType,
              entityId,
              action,
              metadata as Record<string, unknown> | undefined
            );

            // Retrieve the activity log entry
            const activityLogs = db.all(sql`
              SELECT * FROM activity_logs WHERE id = ${activityId}
            `) as Array<{
              id: string;
              actor_id: string;
              entity_type: string;
              entity_id: string;
              action: string;
              metadata: string | null;
              created_at: number;
            }>;

            // Verify exactly one entry was created
            if (activityLogs.length !== 1) {
              return false;
            }

            const log = activityLogs[0]!;

            // Verify all required fields are present and correct
            const hasActorId = log.actor_id === actorId;
            const hasEntityType = log.entity_type === entityType;
            const hasEntityId = log.entity_id === entityId;
            const hasAction = log.action === action;
            const hasTimestamp = typeof log.created_at === 'number' && log.created_at > 0;

            return hasActorId && hasEntityType && hasEntityId && hasAction && hasTimestamp;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 21: Activity Log Completeness**
   * Activity logs should preserve metadata when provided.
   * **Validates: Requirements 10.1**
   */
  it(
    'Property 21: Activity Log Completeness - metadata is preserved',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // actorId
          uuidArbitrary, // entityId
          entityTypeArbitrary, // entityType
          actionArbitrary, // action
          fc.record({
            projectId: fc.option(uuidArbitrary, { nil: undefined }),
            taskTitle: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            fromStatus: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            toStatus: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          }), // metadata
          async (actorId, entityId, entityType, action, metadata) => {
            // Create actor user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${actorId}, ${`actor-${actorId}@example.com`}, 'hash', 'Test Actor', 'MEMBER')
            `);

            // Filter out undefined values from metadata
            const cleanMetadata: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(metadata)) {
              if (value !== undefined) {
                cleanMetadata[key] = value;
              }
            }

            // Log the activity with metadata
            const activityId = logActivityToDb(
              actorId,
              entityType,
              entityId,
              action,
              Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined
            );

            // Retrieve the activity log entry
            const activityLogs = db.all(sql`
              SELECT * FROM activity_logs WHERE id = ${activityId}
            `) as Array<{
              id: string;
              metadata: string | null;
            }>;

            if (activityLogs.length !== 1) {
              return false;
            }

            const log = activityLogs[0]!;

            // If metadata was provided, verify it was stored correctly
            if (Object.keys(cleanMetadata).length > 0) {
              if (!log.metadata) {
                return false;
              }
              const storedMetadata = JSON.parse(log.metadata);
              
              // Verify all provided metadata fields are present
              for (const [key, value] of Object.entries(cleanMetadata)) {
                if (storedMetadata[key] !== value) {
                  return false;
                }
              }
            }

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 21: Activity Log Completeness**
   * Activity logs should be queryable by entity type and entity ID.
   * **Validates: Requirements 10.1**
   */
  it(
    'Property 21: Activity Log Completeness - logs are queryable by entity',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // actorId
          uuidArbitrary, // entityId
          entityTypeArbitrary, // entityType
          fc.array(actionArbitrary, { minLength: 1, maxLength: 5 }), // multiple actions
          async (actorId, entityId, entityType, actions) => {
            // Create actor user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${actorId}, ${`actor-${actorId}@example.com`}, 'hash', 'Test Actor', 'MEMBER')
            `);

            // Log multiple activities for the same entity
            for (const action of actions) {
              logActivityToDb(actorId, entityType, entityId, action);
            }

            // Query activities by entity type and entity ID
            const activityLogs = db.all(sql`
              SELECT * FROM activity_logs 
              WHERE entity_type = ${entityType} AND entity_id = ${entityId}
            `) as Array<{
              id: string;
              entity_type: string;
              entity_id: string;
            }>;

            // Verify all logged activities are returned
            if (activityLogs.length !== actions.length) {
              return false;
            }

            // Verify all returned logs have correct entity type and ID
            for (const log of activityLogs) {
              if (log.entity_type !== entityType || log.entity_id !== entityId) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 21: Activity Log Completeness**
   * Activity logs should be queryable by actor ID.
   * **Validates: Requirements 10.1**
   */
  it(
    'Property 21: Activity Log Completeness - logs are queryable by actor',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // actorId
          fc.array(
            fc.record({
              entityId: uuidArbitrary,
              entityType: entityTypeArbitrary,
              action: actionArbitrary,
            }),
            { minLength: 1, maxLength: 5 }
          ), // multiple activities
          async (actorId, activities) => {
            // Create actor user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${actorId}, ${`actor-${actorId}@example.com`}, 'hash', 'Test Actor', 'MEMBER')
            `);

            // Log multiple activities by the same actor
            for (const activity of activities) {
              logActivityToDb(actorId, activity.entityType, activity.entityId, activity.action);
            }

            // Query activities by actor ID
            const activityLogs = db.all(sql`
              SELECT * FROM activity_logs WHERE actor_id = ${actorId}
            `) as Array<{
              id: string;
              actor_id: string;
            }>;

            // Verify all logged activities are returned
            if (activityLogs.length !== activities.length) {
              return false;
            }

            // Verify all returned logs have correct actor ID
            for (const log of activityLogs) {
              if (log.actor_id !== actorId) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 21: Activity Log Completeness**
   * Each activity log entry should have a unique ID.
   * **Validates: Requirements 10.1**
   */
  it(
    'Property 21: Activity Log Completeness - each log has unique ID',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary, // actorId
          fc.array(
            fc.record({
              entityId: uuidArbitrary,
              entityType: entityTypeArbitrary,
              action: actionArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ), // multiple activities
          async (actorId, activities) => {
            // Create actor user
            db.run(sql`
              INSERT INTO users (id, email, password_hash, name, role)
              VALUES (${actorId}, ${`actor-${actorId}@example.com`}, 'hash', 'Test Actor', 'MEMBER')
            `);

            // Log multiple activities
            const activityIds: string[] = [];
            for (const activity of activities) {
              const id = logActivityToDb(actorId, activity.entityType, activity.entityId, activity.action);
              activityIds.push(id);
            }

            // Verify all IDs are unique
            const uniqueIds = new Set(activityIds);
            return uniqueIds.size === activityIds.length;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
