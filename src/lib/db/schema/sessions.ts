import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersSqlite } from "./users";

// Sessions Table (PostgreSQL)
export const sessionsSqlite = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "cascade" }),
    csrfToken: text("csrf_token").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

// Export types
export type Session = typeof sessionsSqlite.$inferSelect;
export type NewSession = typeof sessionsSqlite.$inferInsert;
