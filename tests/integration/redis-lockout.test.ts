/**
 * Integration tests for distributed lockout with real Redis
 *
 * Tests lockout behavior with real Redis across multiple simulated clients.
 * Uses testcontainers to provide a real Redis instance.
 *
 * Requirements: 5.2
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startRedisContainer,
  stopRedisContainer,
  createAdditionalClient,
  clearRedisData,
  type RedisTestContext,
} from "../setup/redis-container";
import {
  recordFailedAttempt,
  isLocked,
  clearAttempts,
  unlockAccount,
  getFailedAttemptCount,
  getRemainingLockoutTime,
  setRedisClient,
  LOCKOUT_CONFIG,
} from "@/lib/auth/lockout";

// Extend timeout for container startup
const CONTAINER_TIMEOUT = 120000;

/**
 * Check if Docker is available for testcontainers
 */
async function isDockerAvailable(): Promise<boolean> {
  try {
    // Try to start a container - if Docker isn't available, this will fail
    const ctx = await startRedisContainer({ startupTimeout: 30000 });
    await stopRedisContainer(ctx);
    return true;
  } catch {
    return false;
  }
}

// Check Docker availability before running tests
let dockerAvailable = false;
let skipReason = "";

beforeAll(async () => {
  try {
    dockerAvailable = await isDockerAvailable();
  } catch (error) {
    dockerAvailable = false;
    skipReason = error instanceof Error ? error.message : "Unknown error";
  }
}, CONTAINER_TIMEOUT);

describe("Distributed Lockout Integration Tests", () => {
  let ctx: RedisTestContext | undefined;

  beforeAll(async () => {
    if (!dockerAvailable) {
      console.log(
        `Skipping Redis integration tests: Docker not available. ${skipReason}`
      );
      return;
    }
    ctx = await startRedisContainer({ startupTimeout: CONTAINER_TIMEOUT });
    // Set the lockout service to use our test Redis client
    setRedisClient(
      ctx.client as unknown as Parameters<typeof setRedisClient>[0]
    );
  }, CONTAINER_TIMEOUT);

  afterAll(async () => {
    setRedisClient(null);
    if (ctx) {
      await stopRedisContainer(ctx);
    }
  });

  beforeEach(async () => {
    if (ctx) {
      await clearRedisData(ctx);
    }
  });

  describe("Basic Lockout Operations with Real Redis", () => {
    /**
     * Requirement 5.2: Test lockout behavior with real Redis
     */
    it("should record failed attempts in Redis", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "test@example.com";
      const ip = "192.168.1.1";

      const result = await recordFailedAttempt(email, ip);

      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(
        LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1
      );

      // Verify attempt count is stored in Redis
      const count = await getFailedAttemptCount(email);
      expect(count).toBe(1);
    });

    /**
     * Requirement 5.2: Test lockout triggers after max attempts
     */
    it("should lock account after max failed attempts", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "lockout@example.com";
      const ip = "192.168.1.2";

      // Record max failed attempts
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      const locked = await isLocked(email);
      expect(locked).toBe(true);

      // Verify lockout time is set
      const remainingTime = await getRemainingLockoutTime(email);
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(
        LOCKOUT_CONFIG.LOCKOUT_DURATION_SECONDS
      );
    });

    /**
     * Requirement 5.2: Test clearing attempts
     */
    it("should clear attempts on successful login", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "clear@example.com";
      const ip = "192.168.1.3";

      // Record some failed attempts
      await recordFailedAttempt(email, ip);
      await recordFailedAttempt(email, ip);

      let count = await getFailedAttemptCount(email);
      expect(count).toBe(2);

      // Clear attempts (simulating successful login)
      await clearAttempts(email);

      count = await getFailedAttemptCount(email);
      expect(count).toBe(0);
    });

    /**
     * Requirement 5.2: Test unlocking account
     */
    it("should unlock a locked account", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "unlock@example.com";
      const ip = "192.168.1.4";

      // Lock the account
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      expect(await isLocked(email)).toBe(true);

      // Unlock the account
      await unlockAccount(email);

      expect(await isLocked(email)).toBe(false);
    });
  });

  describe("Distributed Behavior Across Multiple Clients", () => {
    /**
     * Requirement 5.2: Test distributed lockout - attempts from multiple clients
     * should be aggregated in Redis
     */
    it("should aggregate failed attempts from multiple clients", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "distributed@example.com";
      const client1Ip = "192.168.1.10";
      const client2Ip = "192.168.1.20";
      const client3Ip = "192.168.1.30";

      // Simulate attempts from different clients/IPs
      // Each client records some attempts, but together they exceed the threshold
      await recordFailedAttempt(email, client1Ip);
      await recordFailedAttempt(email, client2Ip);
      await recordFailedAttempt(email, client3Ip);
      await recordFailedAttempt(email, client1Ip);
      await recordFailedAttempt(email, client2Ip);

      // Account should now be locked (5 attempts total)
      const locked = await isLocked(email);
      expect(locked).toBe(true);
    });

    /**
     * Requirement 5.2: Test that lockout state is visible across all clients
     */
    it("should share lockout state across multiple Redis clients", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "shared-state@example.com";
      const ip = "192.168.1.50";

      // Create additional Redis clients to simulate multiple app instances
      const client2 = createAdditionalClient(ctx);
      const client3 = createAdditionalClient(ctx);

      try {
        // Lock account using the primary client
        for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
          await recordFailedAttempt(email, ip);
        }

        // Verify lockout is visible from all clients by checking Redis directly
        const lockoutKey = `login:lockout:${email.toLowerCase()}`;

        const existsClient1 = await ctx.client.exists(lockoutKey);
        const existsClient2 = await client2.exists(lockoutKey);
        const existsClient3 = await client3.exists(lockoutKey);

        expect(existsClient1).toBe(1);
        expect(existsClient2).toBe(1);
        expect(existsClient3).toBe(1);
      } finally {
        await client2.quit();
        await client3.quit();
      }
    });

    /**
     * Requirement 5.2: Test concurrent failed attempts from multiple clients
     */
    it("should handle concurrent failed attempts correctly", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "concurrent@example.com";
      const ips = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5"];

      // Record attempts concurrently
      const promises = ips.map((ip) => recordFailedAttempt(email, ip));
      await Promise.all(promises);

      // Account should be locked after 5 concurrent attempts
      const locked = await isLocked(email);
      expect(locked).toBe(true);
    });

    /**
     * Requirement 5.2: Test that unlock is visible across all clients
     */
    it("should propagate unlock across all clients", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "unlock-propagate@example.com";
      const ip = "192.168.1.60";

      // Create additional client
      const client2 = createAdditionalClient(ctx);

      try {
        // Lock account
        for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
          await recordFailedAttempt(email, ip);
        }

        // Verify locked from both clients
        const lockoutKey = `login:lockout:${email.toLowerCase()}`;
        expect(await ctx.client.exists(lockoutKey)).toBe(1);
        expect(await client2.exists(lockoutKey)).toBe(1);

        // Unlock account
        await unlockAccount(email);

        // Verify unlocked from both clients
        expect(await ctx.client.exists(lockoutKey)).toBe(0);
        expect(await client2.exists(lockoutKey)).toBe(0);
      } finally {
        await client2.quit();
      }
    });
  });

  describe("TTL and Expiration Behavior", () => {
    /**
     * Requirement 5.2: Test that attempt counter has TTL
     */
    it("should set TTL on attempt counter", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "ttl-test@example.com";
      const ip = "192.168.1.70";

      await recordFailedAttempt(email, ip);

      const attemptKey = `login:attempts:${email.toLowerCase()}`;
      const ttl = await ctx.client.ttl(attemptKey);

      // TTL should be set and within the attempt window
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(LOCKOUT_CONFIG.ATTEMPT_WINDOW_SECONDS);
    });

    /**
     * Requirement 5.2: Test that lockout has TTL
     */
    it("should set TTL on lockout", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "lockout-ttl@example.com";
      const ip = "192.168.1.80";

      // Lock the account
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      const lockoutKey = `login:lockout:${email.toLowerCase()}`;
      const ttl = await ctx.client.ttl(lockoutKey);

      // TTL should be set and within the lockout duration
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(LOCKOUT_CONFIG.LOCKOUT_DURATION_SECONDS);
    });
  });

  describe("Edge Cases", () => {
    /**
     * Requirement 5.2: Test behavior with different email cases
     */
    it("should treat email addresses case-insensitively", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const ip = "192.168.1.90";

      // Record attempts with different cases
      await recordFailedAttempt("User@Example.com", ip);
      await recordFailedAttempt("USER@EXAMPLE.COM", ip);
      await recordFailedAttempt("user@example.com", ip);

      // All should count towards the same user
      const count = await getFailedAttemptCount("user@example.com");
      expect(count).toBe(3);
    });

    /**
     * Requirement 5.2: Test that locked account rejects further attempts
     */
    it("should return locked status for attempts on locked account", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const email = "already-locked@example.com";
      const ip = "192.168.1.100";

      // Lock the account
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(email, ip);
      }

      // Try another attempt
      const result = await recordFailedAttempt(email, ip);

      expect(result.isLocked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
    });

    /**
     * Requirement 5.2: Test multiple users don't interfere with each other
     */
    it("should isolate lockout state between different users", async () => {
      if (!ctx) {
        console.log("Skipping: Docker not available");
        return;
      }
      const user1 = "user1@example.com";
      const user2 = "user2@example.com";
      const ip = "192.168.1.110";

      // Lock user1
      for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await recordFailedAttempt(user1, ip);
      }

      // Record some attempts for user2
      await recordFailedAttempt(user2, ip);
      await recordFailedAttempt(user2, ip);

      // User1 should be locked, user2 should not
      expect(await isLocked(user1)).toBe(true);
      expect(await isLocked(user2)).toBe(false);

      // User2 should have correct attempt count
      const count = await getFailedAttemptCount(user2);
      expect(count).toBe(2);
    });
  });
});
