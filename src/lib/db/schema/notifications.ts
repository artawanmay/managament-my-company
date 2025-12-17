import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { usersSqlite } from "./users";

// Notification type values
export const notificationTypeValues = [
  "TASK_ASSIGNED",
  "TASK_MOVED",
  "COMMENT_ADDED",
  "MENTIONED",
  "DEADLINE_APPROACHING",
] as const;
export type NotificationType = (typeof notificationTypeValues)[number];

// Notifications Table
export const notificationsSqlite = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "cascade" }),
    type: text("type", { enum: notificationTypeValues }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: text("data", { mode: "json" }), // JSON with entityType, entityId, etc.
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_read_at_idx").on(table.readAt),
  ]
);

// Export types
export type Notification = typeof notificationsSqlite.$inferSelect;
export type NewNotification = typeof notificationsSqlite.$inferInsert;
