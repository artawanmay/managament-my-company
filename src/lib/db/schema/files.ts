import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projectsSqlite } from "./projects";
import { usersSqlite } from "./users";

// Files Table
export const filesSqlite = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsSqlite.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    path: text("path").notNull(), // Storage path or URL
    size: integer("size").notNull(), // Bytes
    mimeType: text("mime_type").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "restrict" }),
    uploadedAt: integer("uploaded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("files_project_id_idx").on(table.projectId),
    index("files_uploaded_by_idx").on(table.uploadedBy),
  ]
);

// Export types
export type File = typeof filesSqlite.$inferSelect;
export type NewFile = typeof filesSqlite.$inferInsert;
