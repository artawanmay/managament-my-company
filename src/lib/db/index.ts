import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import Database from "better-sqlite3";
import postgres from "postgres";
import * as schema from "./schema/index";

/**
 * Database client with support for both SQLite (development) and PostgreSQL (production).
 * Automatically detects database type from DATABASE_URL.
 */

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

/**
 * Check if the database URL is for PostgreSQL
 */
function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

// Create database connection based on URL type
let db: ReturnType<typeof drizzleSqlite> | ReturnType<typeof drizzlePg>;
let client: Database.Database | ReturnType<typeof postgres>;

if (isPostgresUrl(databaseUrl)) {
  // PostgreSQL configuration for production
  const pgClient = postgres(databaseUrl);
  db = drizzlePg(pgClient, { schema });
  client = pgClient;
} else {
  // SQLite configuration for development
  const filePath = databaseUrl.startsWith("file:")
    ? databaseUrl.slice(5)
    : databaseUrl;

  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  db = drizzleSqlite(sqlite, { schema });
  client = sqlite;
}

export { db, client, schema };

// Type for the database instance
export type DatabaseInstance = typeof db;
