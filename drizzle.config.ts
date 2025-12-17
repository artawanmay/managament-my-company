import { defineConfig } from "drizzle-kit";
import type { Config } from "drizzle-kit";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

/**
 * Detect database type from DATABASE_URL
 * - URLs starting with postgresql:// or postgres:// use PostgreSQL
 * - All other URLs (including file:) use SQLite for development
 */
function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

/**
 * Build Drizzle configuration based on database type
 * - PostgreSQL for production (DATABASE_URL starts with postgresql://)
 * - SQLite for development (default or file: URLs)
 */
function buildConfig(): Config {
  const baseConfig = {
    schema: "./src/lib/db/schema/index.ts",
    out: "./drizzle",
    verbose: true,
    strict: true,
  };

  if (isPostgresUrl(databaseUrl)) {
    // PostgreSQL configuration for production
    return {
      ...baseConfig,
      dialect: "postgresql",
      dbCredentials: {
        url: databaseUrl,
      },
    };
  }

  // SQLite configuration for development
  return {
    ...baseConfig,
    dialect: "sqlite",
    dbCredentials: {
      url: databaseUrl,
    },
  };
}

export default defineConfig(buildConfig());
