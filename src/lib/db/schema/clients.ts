import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Client status values
export const clientStatusValues = ['ACTIVE', 'INACTIVE', 'PROSPECT'] as const;
export type ClientStatus = (typeof clientStatusValues)[number];

// Clients Table
export const clientsSqlite = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    picName: text('pic_name'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    website: text('website'),
    status: text('status', { enum: clientStatusValues }).notNull().default('PROSPECT'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('clients_status_idx').on(table.status)]
);

// Export types
export type Client = typeof clientsSqlite.$inferSelect;
export type NewClient = typeof clientsSqlite.$inferInsert;
