import { pgTable, text, integer, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersSqlite } from "./users";

// Entity type values
export const entityTypeValues = [
  "CLIENT",
  "PROJECT",
  "TASK",
  "NOTE",
  "FILE",
  "COMMENT",
  "USER",
] as const;
export type EntityType = (typeof entityTypeValues)[number];

// Action values
export const actionValues = [
  "CREATED",
  "UPDATED",
  "DELETED",
  "MOVED",
  "ARCHIVED",
] as const;
export type Action = (typeof actionValues)[number];

// Activity Logs Table (PostgreSQL)
export const activityLogsSqlite = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "cascade" }),
    entityType: text("entity_type", { enum: entityTypeValues }).notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", { enum: actionValues }).notNull(),
    metadata: jsonb("metadata"), // JSON with additional context
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::integer`),
  },
  (table) => [
    index("activity_logs_actor_id_idx").on(table.actorId),
    index("activity_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);

// Export types
export type ActivityLog = typeof activityLogsSqlite.$inferSelect;
export type NewActivityLog = typeof activityLogsSqlite.$inferInsert;
