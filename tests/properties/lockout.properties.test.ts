/**
 * Property-based tests for login lockout mechanism
 *
 * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
 * *For any* email address, after 5 failed login attempts within 15 minutes,
 * subsequent login attempts should be rejected with a lockout message until
 * 30 minutes have passed.
 * **Validates: Requirements 1.3, 18.3**
 */
import { describe, it, beforeEach, afterAll } from 'vitest';
import * as fc from 'fast-check';
import {
  recordFailedAttempt,
  isLocked,
  clearAttempts,
  getRemainingLockoutTime,
  getFailedAttemptCount,
  unlockAccount,
  setRedisClient,
  LOCKOUT_CONFIG,
} from '@/lib/auth/lockout';
import { getMockRedisClient, resetMockRedis } from '../setup/mock-redis';

const PBT_RUNS = 50;
const TEST_TIMEOUT = 30000;

// Email generator that produces valid email-like strings
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{3,10}$/),
    fc.stringMatching(/^[a-z]{3,8}$/),
    fc.constantFrom('com', 'org', 'net', 'io')
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// IP address generator
const ipArb = fc
  .tuple(
    fc.integer({ min: 1, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

describe('Login Lockout Properties', () => {
  // Set up mock Redis before all tests
  beforeEach(() => {
    // Use mock Redis for testing
    setRedisClient(getMockRedisClient());
    // Clear all data before each test
    resetMockRedis();
  });

  // Reset to real Redis after all tests
  afterAll(() => {
    setRedisClient(null);
  });

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Recording fewer than MAX_FAILED_ATTEMPTS should not trigger lockout
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - fewer than max attempts does not lock',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArb,
          ipArb,
          fc.integer({ min: 1, max: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1 }),
          async (email, ip, attemptCount) => {
            // Clean up before test
            await unlockAccount(email);

            // Record fewer than max attempts
            for (let i = 0; i < attemptCount; i++) {
              await recordFailedAttempt(email, ip);
            }

            // Should not be locked
            const locked = await isLocked(email);
            return locked === false;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Recording exactly MAX_FAILED_ATTEMPTS should trigger lockout
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - exactly max attempts triggers lock',
    async () => {
      await fc.assert(
        fc.asyncProperty(emailArb, ipArb, async (email, ip) => {
          // Clean up before test
          await unlockAccount(email);

          // Record exactly max attempts
          for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
            await recordFailedAttempt(email, ip);
          }

          // Should be locked
          const locked = await isLocked(email);
          return locked === true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Locked accounts have positive remaining lockout time
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - locked accounts have remaining time',
    async () => {
      await fc.assert(
        fc.asyncProperty(emailArb, ipArb, async (email, ip) => {
          // Clean up before test
          await unlockAccount(email);

          // Trigger lockout
          for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
            await recordFailedAttempt(email, ip);
          }

          // Should have remaining lockout time
          const remainingTime = await getRemainingLockoutTime(email);
          return remainingTime > 0 && remainingTime <= LOCKOUT_CONFIG.LOCKOUT_DURATION_SECONDS;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Clearing attempts resets the counter
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - clearing attempts resets counter',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArb,
          ipArb,
          fc.integer({ min: 1, max: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1 }),
          async (email, ip, attemptCount) => {
            // Clean up before test
            await unlockAccount(email);

            // Record some attempts
            for (let i = 0; i < attemptCount; i++) {
              await recordFailedAttempt(email, ip);
            }

            // Clear attempts
            await clearAttempts(email);

            // Counter should be zero
            const count = await getFailedAttemptCount(email);
            return count === 0;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Unlocking account removes lockout
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - unlocking removes lockout',
    async () => {
      await fc.assert(
        fc.asyncProperty(emailArb, ipArb, async (email, ip) => {
          // Clean up before test
          await unlockAccount(email);

          // Trigger lockout
          for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
            await recordFailedAttempt(email, ip);
          }

          // Verify locked
          const lockedBefore = await isLocked(email);
          if (!lockedBefore) return false;

          // Unlock
          await unlockAccount(email);

          // Should no longer be locked
          const lockedAfter = await isLocked(email);
          return lockedAfter === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Email normalization - same email with different case should share lockout
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - email case insensitivity',
    async () => {
      await fc.assert(
        fc.asyncProperty(emailArb, ipArb, async (email, ip) => {
          // Clean up before test
          await unlockAccount(email);

          const upperEmail = email.toUpperCase();
          const lowerEmail = email.toLowerCase();

          // Record attempts with different cases
          for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
            // Alternate between upper and lower case
            const emailToUse = i % 2 === 0 ? upperEmail : lowerEmail;
            await recordFailedAttempt(emailToUse, ip);
          }

          // Both should be locked (same account)
          const lockedUpper = await isLocked(upperEmail);
          const lockedLower = await isLocked(lowerEmail);

          return lockedUpper === true && lockedLower === true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: Attempt counter increments correctly
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - attempt counter increments',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArb,
          ipArb,
          fc.integer({ min: 1, max: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1 }),
          async (email, ip, attemptCount) => {
            // Clean up before test
            await unlockAccount(email);

            // Record attempts
            for (let i = 0; i < attemptCount; i++) {
              await recordFailedAttempt(email, ip);
            }

            // Counter should match
            const count = await getFailedAttemptCount(email);
            return count === attemptCount;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 4: Login Lockout Mechanism**
   * Property: recordFailedAttempt returns correct remaining attempts
   * **Validates: Requirements 1.3, 18.3**
   */
  it(
    'Property 4: Login Lockout - returns correct remaining attempts',
    async () => {
      await fc.assert(
        fc.asyncProperty(emailArb, ipArb, async (email, ip) => {
          // Clean up before test
          await unlockAccount(email);

          // Record attempts and check remaining
          for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
            const result = await recordFailedAttempt(email, ip);
            const expectedRemaining = LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - (i + 1);

            if (i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1) {
              // Not yet locked
              if (result.isLocked !== false) return false;
              if (result.attemptsRemaining !== expectedRemaining) return false;
            } else {
              // Should be locked on last attempt
              if (result.isLocked !== true) return false;
              if (result.attemptsRemaining !== 0) return false;
            }
          }

          return true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
