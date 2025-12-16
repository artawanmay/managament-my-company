import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { usersSqlite } from './users';

// Sessions Table
export const sessionsSqlite = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => usersSqlite.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)]
);

// Export types
export type Session = typeof sessionsSqlite.$inferSelect;
export type NewSession = typeof sessionsSqlite.$inferInsert;
