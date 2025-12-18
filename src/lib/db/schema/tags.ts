import { pgTable, text, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Tags Table (PostgreSQL)
export const tagsSqlite = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // Hex color
  createdAt: integer("created_at")
    .notNull()
    .default(sql`extract(epoch from now())::integer`),
});

// Export types
export type Tag = typeof tagsSqlite.$inferSelect;
export type NewTag = typeof tagsSqlite.$inferInsert;
