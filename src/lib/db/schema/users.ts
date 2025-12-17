import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Role enum values - 4 roles: SUPER_ADMIN, MANAGER, MEMBER, GUEST (ADMIN removed)
export const roleValues = ['SUPER_ADMIN', 'MANAGER', 'MEMBER', 'GUEST'] as const;
export type Role = (typeof roleValues)[number];

// Theme preference values
export const themeValues = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof themeValues)[number];

// Users Table
export const usersSqlite = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: roleValues }).notNull().default('MEMBER'),
  avatarUrl: text('avatar_url'),
  themePreference: text('theme_preference', { enum: themeValues }).notNull().default('system'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Export types
export type User = typeof usersSqlite.$inferSelect;
export type NewUser = typeof usersSqlite.$inferInsert;
