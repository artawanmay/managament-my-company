import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clientsSqlite } from "./clients";
import { usersSqlite } from "./users";

// Project status values
export const projectStatusValues = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type ProjectStatus = (typeof projectStatusValues)[number];

// Priority values
export const priorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof priorityValues)[number];

// Projects Table (PostgreSQL)
export const projectsSqlite = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clientsSqlite.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: projectStatusValues })
      .notNull()
      .default("PLANNING"),
    priority: text("priority", { enum: priorityValues })
      .notNull()
      .default("MEDIUM"),
    startDate: integer("start_date"),
    endDate: integer("end_date"),
    managerId: text("manager_id")
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
    index("projects_client_id_idx").on(table.clientId),
    index("projects_manager_id_idx").on(table.managerId),
    index("projects_status_idx").on(table.status),
  ]
);

// Export types
export type Project = typeof projectsSqlite.$inferSelect;
export type NewProject = typeof projectsSqlite.$inferInsert;
