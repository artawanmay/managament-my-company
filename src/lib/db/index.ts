import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index';

/**
 * Database client for SQLite.
 * For production PostgreSQL support, this file can be extended
 * with dialect detection and PostgreSQL client initialization.
 */

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

// Extract file path from SQLite URL
const filePath = databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl;

// Create SQLite database connection
const sqlite = new Database(filePath);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export the raw SQLite client for advanced operations
export const client = sqlite;

// Re-export schema for convenience
export { schema };

// Type for the database instance
export type Database = typeof db;
