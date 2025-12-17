/**
 * Property-based tests for authentication
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

// Argon2 hashing is computationally expensive, so we use fewer runs
// but still enough to provide good coverage
const PBT_RUNS = 20;
const TEST_TIMEOUT = 60000; // 60 seconds for expensive crypto operations

describe("Password Hashing Properties", () => {
  /**
   * **Feature: mmc-app, Property 12: Password Hash Verification**
   * *For any* password string, hashing with argon2 and then verifying the original
   * password against the hash should return true, and verifying a different password
   * should return false.
   * **Validates: Requirements 18.1**
   */
  it(
    "Property 12: Password Hash Verification - correct password verifies",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (password) => {
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(password, hash);
            return isValid === true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 12: Password Hash Verification**
   * Verifying a different password should return false.
   * **Validates: Requirements 18.1**
   */
  it(
    "Property 12: Password Hash Verification - different password fails",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (password, differentPassword) => {
            // Skip if passwords happen to be the same
            fc.pre(password !== differentPassword);

            const hash = await hashPassword(password);
            const isValid = await verifyPassword(differentPassword, hash);
            return isValid === false;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 12: Password Hash Verification**
   * Hash should never equal the original password (security property).
   * **Validates: Requirements 18.1**
   */
  it(
    "Property 12: Password Hash Verification - hash differs from plaintext",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (password) => {
            const hash = await hashPassword(password);
            return hash !== password;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
