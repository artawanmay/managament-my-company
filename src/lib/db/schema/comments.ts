import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { tasksSqlite } from "./tasks";
import { usersSqlite } from "./users";

// Comments Table
export const commentsSqlite = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasksSqlite.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    mentions: text("mentions", { mode: "json" }).$type<string[]>(), // Array of user IDs
    attachments: text("attachments", { mode: "json" }).$type<string[]>(), // Array of file URLs
    isEdited: integer("is_edited", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("comments_task_id_idx").on(table.taskId),
    index("comments_user_id_idx").on(table.userId),
  ]
);

// Export types
export type Comment = typeof commentsSqlite.$inferSelect;
export type NewComment = typeof commentsSqlite.$inferInsert;
