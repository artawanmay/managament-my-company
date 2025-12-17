/**
 * Property-based tests for client management
 * Tests client status filtering
 */
import { describe, it, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/lib/db/schema/index";
import { sql } from "drizzle-orm";
import { clientStatusValues, type ClientStatus } from "@/lib/db/schema";

const PBT_RUNS = 100;

// Arbitrary generators for client status
const clientStatusArb = fc.constantFrom(...clientStatusValues);

// Generate a valid client name
const clientNameArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

// Helper to create test database
function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

// Initialize test database with required tables
function initTestDb(db: ReturnType<typeof createTestDb>["db"]) {
  // Create clients table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pic_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      website TEXT,
      status TEXT NOT NULL DEFAULT 'PROSPECT',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create index on status
  db.run(sql`CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status)`);
}

// Helper function to filter clients by status (simulates the API filtering logic)
function filterClientsByStatus(
  db: ReturnType<typeof createTestDb>["db"],
  status: ClientStatus
): { id: string; name: string; status: string }[] {
  // Use raw query to get results
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "SELECT id, name, status FROM clients WHERE status = ?"
  );
  return stmt.all(status) as { id: string; name: string; status: string }[];
}

// Helper function to get all clients
function getAllClients(
  db: ReturnType<typeof createTestDb>["db"]
): { id: string; name: string; status: string }[] {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare("SELECT id, name, status FROM clients");
  return stmt.all() as { id: string; name: string; status: string }[];
}

// Helper function to insert a client
function insertClient(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
  name: string,
  status: ClientStatus
): void {
  const sqlite = (db as unknown as { session: { client: Database.Database } })
    .session.client;
  const stmt = sqlite.prepare(
    "INSERT INTO clients (id, name, status) VALUES (?, ?, ?)"
  );
  stmt.run(id, name, status);
}

describe("Client Status Filtering Properties", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    initTestDb(testDb.db);
  });

  afterEach(() => {
    testDb.sqlite.close();
  });

  /**
   * **Feature: mmc-app, Property 14: Client Status Filtering**
   * *For any* status filter value (ACTIVE, INACTIVE, PROSPECT), the returned client list
   * should only contain clients with that exact status.
   * **Validates: Requirements 3.3**
   */
  it("Property 14: Client Status Filtering - filtered results contain only matching status", () => {
    fc.assert(
      fc.property(
        // Generate a list of clients with random statuses
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: clientNameArb,
            status: clientStatusArb,
          }),
          { minLength: 1, maxLength: 50 }
        ),
        // Generate a status to filter by
        clientStatusArb,
        (clients, filterStatus) => {
          // Insert all clients into the database
          for (const client of clients) {
            insertClient(testDb.db, client.id, client.name, client.status);
          }

          // Filter clients by the selected status
          const filteredClients = filterClientsByStatus(
            testDb.db,
            filterStatus
          );

          // Verify all returned clients have the correct status
          const allMatchStatus = filteredClients.every(
            (client) => client.status === filterStatus
          );

          // Clean up for next iteration
          testDb.sqlite.exec("DELETE FROM clients");

          return allMatchStatus;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 14: Client Status Filtering**
   * Filtering should return all clients with the matching status (completeness)
   * **Validates: Requirements 3.3**
   */
  it("Property 14: Client Status Filtering - all matching clients are returned", () => {
    fc.assert(
      fc.property(
        // Generate a list of clients with random statuses
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: clientNameArb,
            status: clientStatusArb,
          }),
          { minLength: 1, maxLength: 50 }
        ),
        // Generate a status to filter by
        clientStatusArb,
        (clients, filterStatus) => {
          // Insert all clients into the database
          for (const client of clients) {
            insertClient(testDb.db, client.id, client.name, client.status);
          }

          // Filter clients by the selected status
          const filteredClients = filterClientsByStatus(
            testDb.db,
            filterStatus
          );

          // Count expected matches from input
          const expectedCount = clients.filter(
            (c) => c.status === filterStatus
          ).length;

          // Clean up for next iteration
          testDb.sqlite.exec("DELETE FROM clients");

          // Verify the count matches
          return filteredClients.length === expectedCount;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 14: Client Status Filtering**
   * Filtering by a status should not return clients with different statuses
   * **Validates: Requirements 3.3**
   */
  it("Property 14: Client Status Filtering - no clients with different status are returned", () => {
    fc.assert(
      fc.property(
        // Generate a list of clients with random statuses
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: clientNameArb,
            status: clientStatusArb,
          }),
          { minLength: 1, maxLength: 50 }
        ),
        // Generate a status to filter by
        clientStatusArb,
        (clients, filterStatus) => {
          // Insert all clients into the database
          for (const client of clients) {
            insertClient(testDb.db, client.id, client.name, client.status);
          }

          // Filter clients by the selected status
          const filteredClients = filterClientsByStatus(
            testDb.db,
            filterStatus
          );

          // Get IDs of filtered clients
          const filteredIds = new Set(filteredClients.map((c) => c.id));

          // Verify no client with a different status is in the filtered results
          const noWrongStatus = clients
            .filter((c) => c.status !== filterStatus)
            .every((c) => !filteredIds.has(c.id));

          // Clean up for next iteration
          testDb.sqlite.exec("DELETE FROM clients");

          return noWrongStatus;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 14: Client Status Filtering**
   * Empty filter result when no clients match the status
   * **Validates: Requirements 3.3**
   */
  it("Property 14: Client Status Filtering - empty result when no matches", () => {
    fc.assert(
      fc.property(
        // Generate a list of clients with a specific status
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: clientNameArb,
            status: fc.constant("ACTIVE" as ClientStatus),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (clients) => {
          // Insert all clients with ACTIVE status
          for (const client of clients) {
            insertClient(testDb.db, client.id, client.name, client.status);
          }

          // Filter by INACTIVE status (should return empty)
          const filteredClients = filterClientsByStatus(testDb.db, "INACTIVE");

          // Clean up for next iteration
          testDb.sqlite.exec("DELETE FROM clients");

          // Should return empty array
          return filteredClients.length === 0;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  /**
   * **Feature: mmc-app, Property 14: Client Status Filtering**
   * Each status filter is independent - filtering by one status doesn't affect others
   * **Validates: Requirements 3.3**
   */
  it("Property 14: Client Status Filtering - status filters are independent", () => {
    fc.assert(
      fc.property(
        // Generate a list of clients with random statuses
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: clientNameArb,
            status: clientStatusArb,
          }),
          { minLength: 5, maxLength: 50 }
        ),
        (clients) => {
          // Insert all clients into the database
          for (const client of clients) {
            insertClient(testDb.db, client.id, client.name, client.status);
          }

          // Get all clients
          const allClients = getAllClients(testDb.db);

          // Filter by each status and sum the counts
          let totalFiltered = 0;
          for (const status of clientStatusValues) {
            const filtered = filterClientsByStatus(testDb.db, status);
            totalFiltered += filtered.length;
          }

          // Clean up for next iteration
          testDb.sqlite.exec("DELETE FROM clients");

          // Sum of all filtered results should equal total clients
          // (each client belongs to exactly one status)
          return totalFiltered === allClients.length;
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});
