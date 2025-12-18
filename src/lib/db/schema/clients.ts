import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Client status values
export const clientStatusValues = ["ACTIVE", "INACTIVE", "PROSPECT"] as const;
export type ClientStatus = (typeof clientStatusValues)[number];

// Clients Table (PostgreSQL)
export const clientsSqlite = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    picName: text("pic_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    website: text("website"),
    status: text("status", { enum: clientStatusValues })
      .notNull()
      .default("PROSPECT"),
    notes: text("notes"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
  },
  (table) => [index("clients_status_idx").on(table.status)]
);

// Export types
export type Client = typeof clientsSqlite.$inferSelect;
export type NewClient = typeof clientsSqlite.$inferInsert;
