import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { notesSqlite } from "./notes";
import { usersSqlite } from "./users";

// Note access action values
export const noteAccessActionValues = ["VIEW_SECRET"] as const;
export type NoteAccessAction = (typeof noteAccessActionValues)[number];

// Note Access Logs Table
export const noteAccessLogsSqlite = sqliteTable(
  "note_access_logs",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notesSqlite.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "cascade" }),
    action: text("action", { enum: noteAccessActionValues }).notNull(),
    ip: text("ip").notNull(),
    userAgent: text("user_agent").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("note_access_logs_note_id_idx").on(table.noteId),
    index("note_access_logs_user_id_idx").on(table.userId),
  ]
);

// Export types
export type NoteAccessLog = typeof noteAccessLogsSqlite.$inferSelect;
export type NewNoteAccessLog = typeof noteAccessLogsSqlite.$inferInsert;
