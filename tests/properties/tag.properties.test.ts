/**
 * Property-based tests for tag system
 * Tests tag filtering accuracy and tag attachment uniqueness
 */
import { describe, it, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/lib/db/schema/index";
import { sql } from "drizzle-orm";
import { taggableTypeValues, type TaggableType } from "@/lib/db/schema";

const PBT_RUNS = 100;

// Arbitrary generators
const taggableTypeArb = fc.constantFrom(...taggableTypeValues);
const tagNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);
const hexColorArb = fc
  .array(
    fc.constantFrom(
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F"
    ),
    {
      minLength: 6,
      maxLength: 6,
    }
  )
  .map((chars) => `#${chars.join("")}`);

// Helper to create test database
function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

// Initialize test database with required tables
function initTestDb(db: ReturnType<typeof createTestDb>["db"]) {
  // Create tags table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create taggables table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS taggables (
      id TEXT PRIMARY KEY,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      taggable_type TEXT NOT NULL,
      taggable_id TEXT NOT NULL,
      UNIQUE(tag_id, taggable_type, taggable_id)
    )
  `);

  // Create indexes
  db.run(
    sql`CREATE INDEX IF NOT EXISTS taggables_tag_id_idx ON taggables(tag_id)`
  );
  db.run(
    sql`CREATE INDEX IF NOT EXISTS taggables_taggable_idx ON taggables(taggable_type, taggable_id)`
  );

  // Create tasks table (for testing)
  db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'TODO'
    )
  `);

  // Create projects table (for testing)
  db.run(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    )
  `);

  // Create notes table (for testing)
  db.run(sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      system_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'OTHER'
    )
  `);
}

// Helper function to insert a tag
function insertTag(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
  name: string,
  color: string
): void {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "INSERT INTO tags (id, name, color) VALUES (?, ?, ?)"
  );
  stmt.run(id, name, color);
}

// Helper function to insert a taggable
function insertTaggable(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
  tagId: string,
  taggableType: TaggableType,
  taggableId: string
): boolean {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  try {
    const stmt = sqlite.prepare(
      "INSERT INTO taggables (id, tag_id, taggable_type, taggable_id) VALUES (?, ?, ?, ?)"
    );
    stmt.run(id, tagId, taggableType, taggableId);
    return true;
  } catch {
    // Unique constraint violation
    return false;
  }
}

// Helper function to insert a task
function insertTask(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
  projectId: string,
  title: string
): void {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "INSERT INTO tasks (id, project_id, title) VALUES (?, ?, ?)"
  );
  stmt.run(id, projectId, title);
}

// Helper function to insert a project
function insertProject(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
  name: string
): void {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare("INSERT INTO projects (id, name) VALUES (?, ?)");
  stmt.run(id, name);
}

// Helper function to insert a note
function insertNote(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
  systemName: string
): void {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "INSERT INTO notes (id, system_name) VALUES (?, ?)"
  );
  stmt.run(id, systemName);
}

// Helper function to get entities by tag
function getEntitiesByTag(
  db: ReturnType<typeof createTestDb>["db"],
  tagId: string,
  taggableType: TaggableType
): { taggableId: string }[] {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "SELECT taggable_id as taggableId FROM taggables WHERE tag_id = ? AND taggable_type = ?"
  );
  return stmt.all(tagId, taggableType) as { taggableId: string }[];
}

// Helper function to get all taggables for an entity
function getTagsForEntity(
  db: ReturnType<typeof createTestDb>["db"],
  taggableType: TaggableType,
  taggableId: string
): { tagId: string }[] {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "SELECT tag_id as tagId FROM taggables WHERE taggable_type = ? AND taggable_id = ?"
  );
  return stmt.all(taggableType, taggableId) as { tagId: string }[];
}

describe("Tag Filtering Properties", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 18: Tag Filtering Accuracy**
   * *For any* tag and entity type, filtering by that tag should return only entities
   * that have that tag attached.
   * **Validates: Requirements 14.3**
   */
  it("Property 18: Tag Filtering Accuracy - filtered results contain only tagged entities", () => {
    fc.assert(
      fc.property(
        // Generate tags
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: tagNameArb,
            color: hexColorArb,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        // Generate tasks
        fc.array(
          fc.record({
            id: fc.uuid(),
            projectId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generate tag assignments (tag index, task index pairs)
        fc.array(
          fc.record({
            tagIndex: fc.nat(),
            taskIndex: fc.nat(),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (tags, tasks, assignments) => {
          // Ensure unique tag names
          const uniqueTags = tags.filter(
            (tag, index, self) =>
              self.findIndex((t) => t.name === tag.name) === index
          );

          if (uniqueTags.length === 0 || tasks.length === 0) {
            return true; // Skip if no valid data
          }

          // Insert tags
          for (const tag of uniqueTags) {
            insertTag(testDb.db, tag.id, tag.name, tag.color);
          }

          // Insert tasks
          for (const task of tasks) {
            insertTask(testDb.db, task.id, task.projectId, task.title);
          }

          // Create tag assignments
          const assignedPairs = new Set<string>();
          for (const assignment of assignments) {
            const tagIndex = assignment.tagIndex % uniqueTags.length;
            const taskIndex = assignment.taskIndex % tasks.length;
            const tag = uniqueTags[tagIndex]!;
            const task = tasks[taskIndex]!;
            const pairKey = `${tag.id}-${task.id}`;

            if (!assignedPairs.has(pairKey)) {
              insertTaggable(
                testDb.db,
                crypto.randomUUID(),
                tag.id,
                "TASK",
                task.id
              );
              assignedPairs.add(pairKey);
            }
          }

          // For each tag, verify filtering returns only tagged tasks
          for (const tag of uniqueTags) {
            const filteredTasks = getEntitiesByTag(testDb.db, tag.id, "TASK");
            const filteredTaskIds = new Set(
              filteredTasks.map((t) => t.taggableId)
            );

            // Verify all returned tasks have this tag
            for (const taskId of filteredTaskIds) {
              const hasTags = getTagsForEntity(testDb.db, "TASK", taskId);
              const hasThisTag = hasTags.some((t) => t.tagId === tag.id);
              if (!hasThisTag) {
                // Clean up
                testDb.sqlite.exec("DELETE FROM taggables");
                testDb.sqlite.exec("DELETE FROM tags");
                testDb.sqlite.exec("DELETE FROM tasks");
                return false;
              }
            }
          }

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");

          return true;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 18: Tag Filtering Accuracy**
   * Filtering should return all entities with the matching tag (completeness)
   * **Validates: Requirements 14.3**
   */
  it("Property 18: Tag Filtering Accuracy - all tagged entities are returned", () => {
    fc.assert(
      fc.property(
        // Generate a tag
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate tasks
        fc.array(
          fc.record({
            id: fc.uuid(),
            projectId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            shouldTag: fc.boolean(),
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (tag, tasks) => {
          // Insert tag
          insertTag(testDb.db, tag.id, tag.name, tag.color);

          // Insert tasks and tag some of them
          const taggedTaskIds = new Set<string>();
          for (const task of tasks) {
            insertTask(testDb.db, task.id, task.projectId, task.title);
            if (task.shouldTag) {
              insertTaggable(
                testDb.db,
                crypto.randomUUID(),
                tag.id,
                "TASK",
                task.id
              );
              taggedTaskIds.add(task.id);
            }
          }

          // Filter by tag
          const filteredTasks = getEntitiesByTag(testDb.db, tag.id, "TASK");
          const filteredTaskIds = new Set(
            filteredTasks.map((t) => t.taggableId)
          );

          // Verify all tagged tasks are returned
          const allTaggedReturned = [...taggedTaskIds].every((id) =>
            filteredTaskIds.has(id)
          );

          // Verify count matches
          const countMatches = filteredTasks.length === taggedTaskIds.size;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");

          return allTaggedReturned && countMatches;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 18: Tag Filtering Accuracy**
   * Filtering by a tag should not return entities without that tag
   * **Validates: Requirements 14.3**
   */
  it("Property 18: Tag Filtering Accuracy - untagged entities are not returned", () => {
    fc.assert(
      fc.property(
        // Generate two tags
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate tasks
        fc.array(
          fc.record({
            id: fc.uuid(),
            projectId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (tag1, tag2, tasks) => {
          // Ensure different tag names
          if (tag1.name === tag2.name) {
            return true; // Skip
          }

          // Insert tags
          insertTag(testDb.db, tag1.id, tag1.name, tag1.color);
          insertTag(testDb.db, tag2.id, tag2.name, tag2.color);

          // Insert tasks
          for (const task of tasks) {
            insertTask(testDb.db, task.id, task.projectId, task.title);
          }

          // Tag first half with tag1, second half with tag2
          const midpoint = Math.floor(tasks.length / 2);
          const tag1TaskIds = new Set<string>();
          const tag2TaskIds = new Set<string>();

          for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i]!;
            if (i < midpoint) {
              insertTaggable(
                testDb.db,
                crypto.randomUUID(),
                tag1.id,
                "TASK",
                task.id
              );
              tag1TaskIds.add(task.id);
            } else {
              insertTaggable(
                testDb.db,
                crypto.randomUUID(),
                tag2.id,
                "TASK",
                task.id
              );
              tag2TaskIds.add(task.id);
            }
          }

          // Filter by tag1
          const filteredByTag1 = getEntitiesByTag(testDb.db, tag1.id, "TASK");
          const filteredByTag1Ids = new Set(
            filteredByTag1.map((t) => t.taggableId)
          );

          // Verify no tag2-only tasks are in tag1 results
          const noTag2InTag1 = [...tag2TaskIds].every(
            (id) => !filteredByTag1Ids.has(id)
          );

          // Filter by tag2
          const filteredByTag2 = getEntitiesByTag(testDb.db, tag2.id, "TASK");
          const filteredByTag2Ids = new Set(
            filteredByTag2.map((t) => t.taggableId)
          );

          // Verify no tag1-only tasks are in tag2 results
          const noTag1InTag2 = [...tag1TaskIds].every(
            (id) => !filteredByTag2Ids.has(id)
          );

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");

          return noTag2InTag1 && noTag1InTag2;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 18: Tag Filtering Accuracy**
   * Filtering works correctly across different entity types
   * **Validates: Requirements 14.3**
   */
  it("Property 18: Tag Filtering Accuracy - filtering is type-specific", () => {
    fc.assert(
      fc.property(
        // Generate a tag
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate entities of different types
        fc.record({
          taskId: fc.uuid(),
          projectId: fc.uuid(),
          noteId: fc.uuid(),
        }),
        (tag, entities) => {
          // Insert tag
          insertTag(testDb.db, tag.id, tag.name, tag.color);

          // Insert entities
          insertTask(
            testDb.db,
            entities.taskId,
            crypto.randomUUID(),
            "Test Task"
          );
          insertProject(testDb.db, entities.projectId, "Test Project");
          insertNote(testDb.db, entities.noteId, "Test Note");

          // Tag all entities with the same tag
          insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            "TASK",
            entities.taskId
          );
          insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            "PROJECT",
            entities.projectId
          );
          insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            "NOTE",
            entities.noteId
          );

          // Filter by tag for each type
          const filteredTasks = getEntitiesByTag(testDb.db, tag.id, "TASK");
          const filteredProjects = getEntitiesByTag(
            testDb.db,
            tag.id,
            "PROJECT"
          );
          const filteredNotes = getEntitiesByTag(testDb.db, tag.id, "NOTE");

          // Verify each filter returns only the correct type
          const tasksCorrect =
            filteredTasks.length === 1 &&
            filteredTasks[0]!.taggableId === entities.taskId;
          const projectsCorrect =
            filteredProjects.length === 1 &&
            filteredProjects[0]!.taggableId === entities.projectId;
          const notesCorrect =
            filteredNotes.length === 1 &&
            filteredNotes[0]!.taggableId === entities.noteId;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");
          testDb.sqlite.exec("DELETE FROM projects");
          testDb.sqlite.exec("DELETE FROM notes");

          return tasksCorrect && projectsCorrect && notesCorrect;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

describe("Tag Attachment Uniqueness Properties", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 19: Tag Attachment Uniqueness**
   * *For any* tag and entity, attaching the same tag twice should either be idempotent
   * or return a constraint violation error.
   * **Validates: Requirements 14.2**
   */
  it("Property 19: Tag Attachment Uniqueness - duplicate attachment is rejected or idempotent", () => {
    fc.assert(
      fc.property(
        // Generate a tag
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate an entity
        fc.record({
          id: fc.uuid(),
          type: taggableTypeArb,
        }),
        (tag, entity) => {
          // Insert tag
          insertTag(testDb.db, tag.id, tag.name, tag.color);

          // Insert entity based on type
          if (entity.type === "TASK") {
            insertTask(testDb.db, entity.id, crypto.randomUUID(), "Test Task");
          } else if (entity.type === "PROJECT") {
            insertProject(testDb.db, entity.id, "Test Project");
          } else {
            insertNote(testDb.db, entity.id, "Test Note");
          }

          // First attachment should succeed
          const firstResult = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            entity.type,
            entity.id
          );

          // Second attachment should fail (unique constraint)
          const secondResult = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            entity.type,
            entity.id
          );

          // Verify first succeeded and second failed
          const firstSucceeded = firstResult === true;
          const secondFailed = secondResult === false;

          // Verify only one taggable exists
          const taggables = getTagsForEntity(testDb.db, entity.type, entity.id);
          const onlyOneTaggable = taggables.length === 1;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");
          testDb.sqlite.exec("DELETE FROM projects");
          testDb.sqlite.exec("DELETE FROM notes");

          return firstSucceeded && secondFailed && onlyOneTaggable;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 19: Tag Attachment Uniqueness**
   * Different tags can be attached to the same entity
   * **Validates: Requirements 14.2**
   */
  it("Property 19: Tag Attachment Uniqueness - different tags can be attached to same entity", () => {
    fc.assert(
      fc.property(
        // Generate multiple tags
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: tagNameArb,
            color: hexColorArb,
          }),
          { minLength: 2, maxLength: 5 }
        ),
        // Generate an entity
        fc.record({
          id: fc.uuid(),
          type: taggableTypeArb,
        }),
        (tags, entity) => {
          // Ensure unique tag names
          const uniqueTags = tags.filter(
            (tag, index, self) =>
              self.findIndex((t) => t.name === tag.name) === index
          );

          if (uniqueTags.length < 2) {
            return true; // Skip if not enough unique tags
          }

          // Insert tags
          for (const tag of uniqueTags) {
            insertTag(testDb.db, tag.id, tag.name, tag.color);
          }

          // Insert entity based on type
          if (entity.type === "TASK") {
            insertTask(testDb.db, entity.id, crypto.randomUUID(), "Test Task");
          } else if (entity.type === "PROJECT") {
            insertProject(testDb.db, entity.id, "Test Project");
          } else {
            insertNote(testDb.db, entity.id, "Test Note");
          }

          // Attach all tags to the entity
          let allSucceeded = true;
          for (const tag of uniqueTags) {
            const result = insertTaggable(
              testDb.db,
              crypto.randomUUID(),
              tag.id,
              entity.type,
              entity.id
            );
            if (!result) {
              allSucceeded = false;
            }
          }

          // Verify all tags are attached
          const attachedTags = getTagsForEntity(
            testDb.db,
            entity.type,
            entity.id
          );
          const correctCount = attachedTags.length === uniqueTags.length;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");
          testDb.sqlite.exec("DELETE FROM projects");
          testDb.sqlite.exec("DELETE FROM notes");

          return allSucceeded && correctCount;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 19: Tag Attachment Uniqueness**
   * Same tag can be attached to different entities
   * **Validates: Requirements 14.2**
   */
  it("Property 19: Tag Attachment Uniqueness - same tag can be attached to different entities", () => {
    fc.assert(
      fc.property(
        // Generate a tag
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate multiple entities of the same type
        fc.array(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (tag, entities) => {
          // Ensure unique entity IDs
          const uniqueEntities = entities.filter(
            (e, index, self) => self.findIndex((x) => x.id === e.id) === index
          );

          if (uniqueEntities.length < 2) {
            return true; // Skip if not enough unique entities
          }

          // Insert tag
          insertTag(testDb.db, tag.id, tag.name, tag.color);

          // Insert entities as tasks
          for (const entity of uniqueEntities) {
            insertTask(testDb.db, entity.id, crypto.randomUUID(), entity.title);
          }

          // Attach the same tag to all entities
          let allSucceeded = true;
          for (const entity of uniqueEntities) {
            const result = insertTaggable(
              testDb.db,
              crypto.randomUUID(),
              tag.id,
              "TASK",
              entity.id
            );
            if (!result) {
              allSucceeded = false;
            }
          }

          // Verify all entities have the tag
          const taggedEntities = getEntitiesByTag(testDb.db, tag.id, "TASK");
          const correctCount = taggedEntities.length === uniqueEntities.length;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");

          return allSucceeded && correctCount;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 19: Tag Attachment Uniqueness**
   * Same tag can be attached to entities of different types
   * **Validates: Requirements 14.2**
   */
  it("Property 19: Tag Attachment Uniqueness - same tag can be attached to different entity types", () => {
    fc.assert(
      fc.property(
        // Generate a tag
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate entity IDs for each type
        fc.record({
          taskId: fc.uuid(),
          projectId: fc.uuid(),
          noteId: fc.uuid(),
        }),
        (tag, entityIds) => {
          // Insert tag
          insertTag(testDb.db, tag.id, tag.name, tag.color);

          // Insert entities
          insertTask(
            testDb.db,
            entityIds.taskId,
            crypto.randomUUID(),
            "Test Task"
          );
          insertProject(testDb.db, entityIds.projectId, "Test Project");
          insertNote(testDb.db, entityIds.noteId, "Test Note");

          // Attach tag to all entity types
          const taskResult = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            "TASK",
            entityIds.taskId
          );
          const projectResult = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            "PROJECT",
            entityIds.projectId
          );
          const noteResult = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag.id,
            "NOTE",
            entityIds.noteId
          );

          // All should succeed
          const allSucceeded = taskResult && projectResult && noteResult;

          // Verify each type has the tag
          const taskTags = getTagsForEntity(
            testDb.db,
            "TASK",
            entityIds.taskId
          );
          const projectTags = getTagsForEntity(
            testDb.db,
            "PROJECT",
            entityIds.projectId
          );
          const noteTags = getTagsForEntity(
            testDb.db,
            "NOTE",
            entityIds.noteId
          );

          const allHaveTag =
            taskTags.length === 1 &&
            projectTags.length === 1 &&
            noteTags.length === 1;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");
          testDb.sqlite.exec("DELETE FROM projects");
          testDb.sqlite.exec("DELETE FROM notes");

          return allSucceeded && allHaveTag;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 19: Tag Attachment Uniqueness**
   * Uniqueness constraint is per (tag, type, entity) tuple
   * **Validates: Requirements 14.2**
   */
  it("Property 19: Tag Attachment Uniqueness - uniqueness is per tuple", () => {
    fc.assert(
      fc.property(
        // Generate two tags
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        fc.record({
          id: fc.uuid(),
          name: tagNameArb,
          color: hexColorArb,
        }),
        // Generate an entity ID
        fc.uuid(),
        (tag1, tag2, entityId) => {
          // Ensure different tag names
          if (tag1.name === tag2.name) {
            return true; // Skip
          }

          // Insert tags
          insertTag(testDb.db, tag1.id, tag1.name, tag1.color);
          insertTag(testDb.db, tag2.id, tag2.name, tag2.color);

          // Insert entity as task
          insertTask(testDb.db, entityId, crypto.randomUUID(), "Test Task");

          // Attach tag1 to task
          const firstAttach = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag1.id,
            "TASK",
            entityId
          );

          // Attach tag2 to same task (should succeed - different tag)
          const secondAttach = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag2.id,
            "TASK",
            entityId
          );

          // Try to attach tag1 again (should fail - same tuple)
          const duplicateAttach = insertTaggable(
            testDb.db,
            crypto.randomUUID(),
            tag1.id,
            "TASK",
            entityId
          );

          // Verify results
          const firstSucceeded = firstAttach === true;
          const secondSucceeded = secondAttach === true;
          const duplicateFailed = duplicateAttach === false;

          // Verify exactly 2 taggables exist
          const attachedTags = getTagsForEntity(testDb.db, "TASK", entityId);
          const correctCount = attachedTags.length === 2;

          // Clean up
          testDb.sqlite.exec("DELETE FROM taggables");
          testDb.sqlite.exec("DELETE FROM tags");
          testDb.sqlite.exec("DELETE FROM tasks");

          return (
            firstSucceeded && secondSucceeded && duplicateFailed && correctCount
          );
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});
