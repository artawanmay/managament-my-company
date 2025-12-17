/**
 * Property-based tests for credential redaction in logs
 *
 * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
 * *For any* log message that contains connection information, sensitive credentials
 * (passwords, auth tokens) should be redacted before logging.
 * **Validates: Requirements 4.4**
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { redactCredentials } from "@/lib/logger";

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

// Arbitrary for generating valid hostnames (lowercase letters and numbers, with optional dots)
const hostnameArb = fc.stringMatching(
  /^[a-z][a-z0-9]{2,10}(\.[a-z][a-z0-9]{2,10})?$/
);

// Arbitrary for generating valid usernames (uppercase letters to distinguish from hostname)
const usernameArb = fc.stringMatching(/^[A-Z][A-Z0-9]{2,10}$/);

// Arbitrary for generating passwords - use a unique marker pattern that won't appear elsewhere
// Using uppercase X followed by numbers to create unique identifiable passwords
const passwordArb = fc.stringMatching(/^PASS[0-9]{4,8}$/);

// Arbitrary for generating port numbers
const portArb = fc.integer({ min: 1, max: 65535 });

// Arbitrary for generating database numbers
const dbArb = fc.integer({ min: 0, max: 15 });

// Arbitrary for Redis protocol
const protocolArb = fc.constantFrom("redis://", "rediss://");

describe("Credential Redaction Properties", () => {
  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Redis URLs with password-only auth have passwords redacted
   * Format: redis://:password@host
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - password-only auth URLs are redacted",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          protocolArb,
          passwordArb,
          hostnameArb,
          async (protocol, password, hostname) => {
            const url = `${protocol}:${password}@${hostname}`;
            const redacted = redactCredentials(url);

            // The exact password string should not appear in the redacted output
            expect(redacted).not.toContain(password);
            // [REDACTED] should appear in place of the password
            expect(redacted).toContain("[REDACTED]");
            // The expected format should be protocol:[REDACTED]@hostname
            expect(redacted).toBe(`${protocol}:[REDACTED]@${hostname}`);

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Redis URLs with user:password auth have passwords redacted but usernames preserved
   * Format: redis://user:password@host
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - user:password auth URLs preserve username",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          protocolArb,
          usernameArb,
          passwordArb,
          hostnameArb,
          async (protocol, username, password, hostname) => {
            const url = `${protocol}${username}:${password}@${hostname}`;
            const redacted = redactCredentials(url);

            // Password should be replaced with [REDACTED]
            expect(redacted).not.toContain(password);
            expect(redacted).toContain("[REDACTED]");
            // Username should be preserved
            expect(redacted).toContain(username);
            expect(redacted).toContain(hostname);
            expect(redacted).toBe(
              `${protocol}${username}:[REDACTED]@${hostname}`
            );

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Redis URLs with port numbers have passwords redacted
   * Format: redis://user:password@host:port
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - URLs with ports are properly redacted",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          protocolArb,
          usernameArb,
          passwordArb,
          hostnameArb,
          portArb,
          async (protocol, username, password, hostname, port) => {
            const url = `${protocol}${username}:${password}@${hostname}:${port}`;
            const redacted = redactCredentials(url);

            // The exact password string should not appear in the redacted output
            expect(redacted).not.toContain(password);
            // [REDACTED] should appear in place of the password
            expect(redacted).toContain("[REDACTED]");
            // The expected format should be protocol + username:[REDACTED]@hostname:port
            expect(redacted).toBe(
              `${protocol}${username}:[REDACTED]@${hostname}:${port}`
            );

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Redis URLs with database numbers have passwords redacted
   * Format: redis://user:password@host:port/db
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - URLs with database numbers are properly redacted",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          protocolArb,
          usernameArb,
          passwordArb,
          hostnameArb,
          portArb,
          dbArb,
          async (protocol, username, password, hostname, port, db) => {
            const url = `${protocol}${username}:${password}@${hostname}:${port}/${db}`;
            const redacted = redactCredentials(url);

            // The exact password string should not appear in the redacted output
            expect(redacted).not.toContain(password);
            // [REDACTED] should appear in place of the password
            expect(redacted).toContain("[REDACTED]");
            // The expected format should be protocol + username:[REDACTED]@hostname:port/db
            expect(redacted).toBe(
              `${protocol}${username}:[REDACTED]@${hostname}:${port}/${db}`
            );

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Strings without Redis URLs are unchanged
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - non-Redis URL strings are unchanged",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string()
            .filter((s) => !s.includes("redis://") && !s.includes("rediss://")),
          async (input) => {
            const redacted = redactCredentials(input);
            return redacted === input;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Empty and null-like inputs are handled gracefully
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - empty inputs are handled gracefully",
    async () => {
      expect(redactCredentials("")).toBe("");
      expect(redactCredentials(null as unknown as string)).toBe(null);
      expect(redactCredentials(undefined as unknown as string)).toBe(undefined);
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Multiple Redis URLs in a single string are all redacted
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - multiple URLs in string are all redacted",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(protocolArb, usernameArb, passwordArb, hostnameArb),
            { minLength: 2, maxLength: 5 }
          ),
          async (urlParts) => {
            // Build a string with multiple Redis URLs
            const urls = urlParts.map(
              ([protocol, username, password, hostname]) =>
                `${protocol}${username}:${password}@${hostname}`
            );
            const input = urls.join(" and ");
            const redacted = redactCredentials(input);

            // All passwords should be redacted (passwords have unique PASS prefix)
            for (const [, , password] of urlParts) {
              expect(redacted).not.toContain(password);
            }

            // Should contain [REDACTED] for each URL
            const redactedCount = (redacted.match(/\[REDACTED\]/g) || [])
              .length;
            expect(redactedCount).toBe(urlParts.length);

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Redis URLs embedded in error messages are redacted
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - URLs in error messages are redacted",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          protocolArb,
          usernameArb,
          passwordArb,
          hostnameArb,
          fc.constantFrom(
            "Connection failed to",
            "Error connecting to",
            "Failed to authenticate with",
            "Redis connection error"
          ),
          async (protocol, username, password, hostname, errorPrefix) => {
            const url = `${protocol}${username}:${password}@${hostname}`;
            const errorMessage = `${errorPrefix} ${url}`;
            const redacted = redactCredentials(errorMessage);

            // Password should be redacted (passwords have unique PASS prefix)
            expect(redacted).not.toContain(password);
            // [REDACTED] should appear in place of the password
            expect(redacted).toContain("[REDACTED]");
            // The expected redacted URL should be present
            expect(redacted).toBe(
              `${errorPrefix} ${protocol}${username}:[REDACTED]@${hostname}`
            );

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 5: Credential Redaction in Logs**
   * Property: Case insensitivity - both redis:// and REDIS:// are handled
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 5: Credential Redaction - case insensitive protocol matching",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            "redis://",
            "REDIS://",
            "Redis://",
            "rediss://",
            "REDISS://",
            "Rediss://"
          ),
          usernameArb,
          passwordArb,
          hostnameArb,
          async (protocol, username, password, hostname) => {
            const url = `${protocol}${username}:${password}@${hostname}`;
            const redacted = redactCredentials(url);

            // Password should be redacted regardless of protocol case (passwords have unique PASS prefix)
            expect(redacted).not.toContain(password);
            // [REDACTED] should appear in place of the password
            expect(redacted).toContain("[REDACTED]");

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
