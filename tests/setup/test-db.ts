/**
 * Test database setup utilities
 * Creates an in-memory SQLite database for testing
 */
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/lib/db/schema/index";
import { sql } from "drizzle-orm";

// Create in-memory SQLite database for testing
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

// Initialize test database with schema
export async function initTestDb(db: ReturnType<typeof createTestDb>["db"]) {
  // Create users table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      avatar_url TEXT,
      theme_preference TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create sessions table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create index on sessions.user_id
  db.run(
    sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`
  );
}

// Clean up test database
export function cleanupTestDb(sqlite: Database.Database) {
  sqlite.close();
}
