import { pgTable, text, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tasksSqlite } from "./tasks";
import { usersSqlite } from "./users";

// Comments Table (PostgreSQL)
export const commentsSqlite = pgTable(
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
    mentions: jsonb("mentions").$type<string[]>(), // Array of user IDs
    attachments: jsonb("attachments").$type<string[]>(), // Array of file URLs
    isEdited: boolean("is_edited").notNull().default(false),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
  },
  (table) => [
    index("comments_task_id_idx").on(table.taskId),
    index("comments_user_id_idx").on(table.userId),
  ]
);

// Export types
export type Comment = typeof commentsSqlite.$inferSelect;
export type NewComment = typeof commentsSqlite.$inferInsert;
