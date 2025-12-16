import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { usersSqlite } from './users';

// Entity type values
export const entityTypeValues = [
  'CLIENT',
  'PROJECT',
  'TASK',
  'NOTE',
  'FILE',
  'COMMENT',
  'USER',
] as const;
export type EntityType = (typeof entityTypeValues)[number];

// Action values
export const actionValues = ['CREATED', 'UPDATED', 'DELETED', 'MOVED', 'ARCHIVED'] as const;
export type Action = (typeof actionValues)[number];

// Activity Logs Table
export const activityLogsSqlite = sqliteTable(
  'activity_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => usersSqlite.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: entityTypeValues }).notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action', { enum: actionValues }).notNull(),
    metadata: text('metadata', { mode: 'json' }), // JSON with additional context
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('activity_logs_actor_id_idx').on(table.actorId),
    index('activity_logs_entity_idx').on(table.entityType, table.entityId),
  ]
);

// Export types
export type ActivityLog = typeof activityLogsSqlite.$inferSelect;
export type NewActivityLog = typeof activityLogsSqlite.$inferInsert;
