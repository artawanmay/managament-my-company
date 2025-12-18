import { pgTable, text, integer, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clientsSqlite } from "./clients";
import { projectsSqlite } from "./projects";
import { usersSqlite } from "./users";

// Note type values
export const noteTypeValues = ["API", "RDP", "SSH", "DB", "OTHER"] as const;
export type NoteType = (typeof noteTypeValues)[number];

// Notes Table (PostgreSQL)
export const notesSqlite = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: noteTypeValues }).notNull().default("OTHER"),
    systemName: text("system_name").notNull(),
    clientId: text("client_id").references(() => clientsSqlite.id, {
      onDelete: "set null",
    }),
    projectId: text("project_id").references(() => projectsSqlite.id, {
      onDelete: "set null",
    }),
    host: text("host"),
    port: integer("port"),
    username: text("username"),
    secret: text("secret").notNull(), // Encrypted with AES-256-GCM
    metadata: jsonb("metadata"), // JSON for extra fields
    createdBy: text("created_by")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "restrict" }),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "restrict" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
  },
  (table) => [
    index("notes_client_id_idx").on(table.clientId),
    index("notes_project_id_idx").on(table.projectId),
    index("notes_type_idx").on(table.type),
  ]
);

// Export types
export type Note = typeof notesSqlite.$inferSelect;
export type NewNote = typeof notesSqlite.$inferInsert;
