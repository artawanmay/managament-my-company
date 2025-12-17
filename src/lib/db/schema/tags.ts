import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Tags Table
export const tagsSqlite = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // Hex color
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Export types
export type Tag = typeof tagsSqlite.$inferSelect;
export type NewTag = typeof tagsSqlite.$inferInsert;
