import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

/**
 * Database client for PostgreSQL.
 * Used for both development and production.
 */

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create PostgreSQL connection
const client = postgres(databaseUrl);

// Create Drizzle ORM instance
export const db = drizzle(client, { schema });

// Export the raw PostgreSQL client for advanced operations
export { client, schema };

// Type for the database instance
export type Database = typeof db;
