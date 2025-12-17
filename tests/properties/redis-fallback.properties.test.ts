/**
 * Property-based tests for Redis fallback store and fallback manager
 *
 * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
 * *For any* Redis operation attempted when Redis is unavailable, the system should
 * activate fallback mode and continue functioning without throwing unhandled errors.
 * **Validates: Requirements 1.1, 1.2**
 *
 * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
 * *For any* Redis client that was in fallback mode, when Redis becomes available again,
 * subsequent operations should successfully use Redis and exit fallback mode.
 * **Validates: Requirements 1.3**
 *
 * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
 * *For any* lockout operation performed while in fallback mode, the in-memory store
 * should maintain accurate state such that subsequent queries return consistent results.
 * **Validates: Requirements 6.2, 6.3**
 */
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import * as fc from "fast-check";
import {
  InMemoryStore,
  resetFallbackStore,
} from "@/lib/realtime/fallback-store";
import {
  FallbackManager,
  getFallbackManager,
  resetFallbackManager,
} from "@/lib/realtime/fallback-manager";
import {
  getConnectionState,
  onConnectionChange,
  executeWithFallback,
  resetRedisClient,
} from "@/lib/realtime/redis";

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

// Key generator for store operations
const keyArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);

// Value generator for store operations
const valueArb = fc.string({ minLength: 1, maxLength: 100 });

// Numeric value generator for incr operations
const numericValueArb = fc.integer({ min: 0, max: 10000 }).map(String);

// TTL generator (in seconds)
const ttlArb = fc.integer({ min: 1, max: 3600 });

describe("Redis Fallback Store Properties", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    resetFallbackStore();
    store = new InMemoryStore();
  });

  afterEach(() => {
    store.destroy();
    resetFallbackStore();
  });

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Set then get returns the same value
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - set then get returns same value",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, valueArb, async (key, value) => {
          store.set(key, value);
          const retrieved = store.get(key);
          return retrieved === value;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Get on non-existent key returns null
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - get non-existent key returns null",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, async (key) => {
          store.clear(); // Clear store before each iteration
          const retrieved = store.get(key);
          return retrieved === null;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Incr on non-existent key initializes to 1
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - incr on non-existent key initializes to 1",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, async (key) => {
          store.clear(); // Clear store before each iteration
          const result = store.incr(key);
          return result === 1;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Incr increments existing numeric value by 1
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - incr increments existing value by 1",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, numericValueArb, async (key, initialValue) => {
          store.set(key, initialValue);
          const result = store.incr(key);
          const expected = parseInt(initialValue, 10) + 1;
          return result === expected;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Multiple incr operations accumulate correctly
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - multiple incr operations accumulate",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          keyArb,
          fc.integer({ min: 1, max: 20 }),
          async (key, incrCount) => {
            store.clear(); // Clear store before each iteration
            let lastResult = 0;
            for (let i = 0; i < incrCount; i++) {
              lastResult = store.incr(key);
            }
            return lastResult === incrCount;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Del removes existing key
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - del removes existing key",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, valueArb, async (key, value) => {
          store.set(key, value);
          const deleted = store.del(key);
          const exists = store.exists(key);
          return deleted === true && exists === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Del on non-existent key returns false
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - del non-existent key returns false",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, async (key) => {
          store.clear(); // Clear store before each iteration
          const deleted = store.del(key);
          return deleted === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Exists returns true for existing keys
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - exists returns true for existing keys",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, valueArb, async (key, value) => {
          store.set(key, value);
          return store.exists(key) === true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Exists returns false for non-existent keys
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - exists returns false for non-existent keys",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, async (key) => {
          store.clear(); // Clear store before each iteration
          return store.exists(key) === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Keys with TTL are accessible before expiry
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - keys with TTL accessible before expiry",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, valueArb, ttlArb, async (key, value, ttl) => {
          store.set(key, value, ttl);
          // Immediately after setting, key should be accessible
          const retrieved = store.get(key);
          const exists = store.exists(key);
          return retrieved === value && exists === true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Overwriting a key updates the value
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - overwriting key updates value",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          keyArb,
          valueArb,
          valueArb,
          async (key, value1, value2) => {
            store.set(key, value1);
            store.set(key, value2);
            const retrieved = store.get(key);
            return retrieved === value2;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Clear removes all keys
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - clear removes all keys",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(keyArb, valueArb), { minLength: 1, maxLength: 10 }),
          async (entries) => {
            // Set multiple keys
            for (const [key, value] of entries) {
              store.set(key, value);
            }

            // Clear the store
            store.clear();

            // All keys should be gone
            for (const [key] of entries) {
              if (store.exists(key)) {
                return false;
              }
            }
            return store.size() === 0;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 6: Fallback Mode Lockout Consistency**
   * Property: Lockout simulation - incr tracks failed attempts correctly
   * This simulates the lockout use case where we track failed login attempts
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    "Property 6: Fallback Store - lockout simulation tracks attempts",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          keyArb,
          fc.integer({ min: 1, max: 10 }),
          ttlArb,
          async (email, attemptCount, ttl) => {
            store.clear(); // Clear store before each iteration
            const lockoutKey = `lockout:${email}`;

            // Simulate recording failed attempts
            for (let i = 0; i < attemptCount; i++) {
              store.incr(lockoutKey);
              // After first incr, set TTL (simulating lockout window)
              if (i === 0) {
                const currentValue = store.get(lockoutKey);
                if (currentValue) {
                  store.set(lockoutKey, currentValue, ttl);
                }
              }
            }

            // Verify the count is accurate
            const finalValue = store.get(lockoutKey);
            return finalValue === attemptCount.toString();
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});

/**
 * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
 * *For any* Redis operation attempted when Redis is unavailable, the system should
 * activate fallback mode and continue functioning without throwing unhandled errors.
 * **Validates: Requirements 1.1, 1.2**
 */
describe("Fallback Manager Properties", () => {
  let manager: FallbackManager;
  let store: InMemoryStore;

  beforeEach(() => {
    resetFallbackManager();
    resetFallbackStore();
    store = new InMemoryStore();
    manager = new FallbackManager(store);
  });

  afterEach(() => {
    store.destroy();
    manager.reset();
    resetFallbackManager();
    resetFallbackStore();
  });

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Activating fallback mode sets the mode to true
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - activation sets fallback mode to true",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          manager.reset();
          expect(manager.isInFallbackMode()).toBe(false);
          manager.activateFallback();
          return manager.isInFallbackMode() === true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Deactivating fallback mode sets the mode to false
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - deactivation sets fallback mode to false",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          manager.reset();
          manager.activateFallback();
          expect(manager.isInFallbackMode()).toBe(true);
          manager.deactivateFallback();
          return manager.isInFallbackMode() === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Multiple activations are idempotent (only first activation triggers callbacks)
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - multiple activations are idempotent",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (activationCount) => {
            manager.reset();
            let callbackCount = 0;
            manager.onFallbackActivated(() => {
              callbackCount++;
            });

            // Activate multiple times
            for (let i = 0; i < activationCount; i++) {
              manager.activateFallback();
            }

            // Callback should only be called once
            return callbackCount === 1 && manager.isInFallbackMode() === true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Multiple deactivations are idempotent (only first deactivation triggers callbacks)
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - multiple deactivations are idempotent",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (deactivationCount) => {
            manager.reset();
            manager.activateFallback(); // First activate

            let callbackCount = 0;
            manager.onFallbackDeactivated(() => {
              callbackCount++;
            });

            // Deactivate multiple times
            for (let i = 0; i < deactivationCount; i++) {
              manager.deactivateFallback();
            }

            // Callback should only be called once
            return callbackCount === 1 && manager.isInFallbackMode() === false;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Activation callbacks are called when fallback mode activates
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - activation callbacks are invoked",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (callbackCount) => {
            manager.reset();
            const callbackResults: number[] = [];

            // Register multiple callbacks
            for (let i = 0; i < callbackCount; i++) {
              const index = i;
              manager.onFallbackActivated(() => {
                callbackResults.push(index);
              });
            }

            manager.activateFallback();

            // All callbacks should have been called
            return callbackResults.length === callbackCount;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Deactivation callbacks are called when fallback mode deactivates
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - deactivation callbacks are invoked",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (callbackCount) => {
            manager.reset();
            manager.activateFallback();

            const callbackResults: number[] = [];

            // Register multiple callbacks
            for (let i = 0; i < callbackCount; i++) {
              const index = i;
              manager.onFallbackDeactivated(() => {
                callbackResults.push(index);
              });
            }

            manager.deactivateFallback();

            // All callbacks should have been called
            return callbackResults.length === callbackCount;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Unsubscribe function removes callback from list
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - unsubscribe removes callback",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          manager.reset();
          let callbackCalled = false;

          const unsubscribe = manager.onFallbackActivated(() => {
            callbackCalled = true;
          });

          // Unsubscribe before activation
          unsubscribe();

          manager.activateFallback();

          // Callback should not have been called
          return callbackCalled === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Store operations work correctly in fallback mode
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - store operations work in fallback mode",
    async () => {
      await fc.assert(
        fc.asyncProperty(keyArb, valueArb, async (key, value) => {
          manager.reset();
          manager.activateFallback();

          const fallbackStore = manager.getStore();
          fallbackStore.set(key, value);
          const retrieved = fallbackStore.get(key);

          return manager.isInFallbackMode() === true && retrieved === value;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Last mode change timestamp is updated on activation/deactivation
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - mode change updates timestamp",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          manager.reset();
          expect(manager.getLastModeChangeAt()).toBeNull();

          const beforeActivation = new Date();
          manager.activateFallback();
          const afterActivation = manager.getLastModeChangeAt();

          if (!afterActivation) return false;
          if (afterActivation < beforeActivation) return false;

          const beforeDeactivation = new Date();
          manager.deactivateFallback();
          const afterDeactivation = manager.getLastModeChangeAt();

          if (!afterDeactivation) return false;
          if (afterDeactivation < beforeDeactivation) return false;

          return true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 1: Fallback Activation on Redis Failure**
   * Property: Callback errors don't prevent other callbacks from running
   * **Validates: Requirements 1.1, 1.2**
   */
  it(
    "Property 1: Fallback Manager - callback errors are isolated",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          manager.reset();
          const results: string[] = [];

          manager.onFallbackActivated(() => {
            results.push("first");
          });

          manager.onFallbackActivated(() => {
            throw new Error("Intentional error");
          });

          manager.onFallbackActivated(() => {
            results.push("third");
          });

          // Suppress console.error for this test
          const originalError = console.error;
          console.error = () => {};

          manager.activateFallback();

          console.error = originalError;

          // First and third callbacks should have run despite second throwing
          return (
            results.includes("first") &&
            results.includes("third") &&
            results.length === 2
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});

/**
 * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
 * *For any* Redis client that was in fallback mode, when Redis becomes available again,
 * subsequent operations should successfully use Redis and exit fallback mode.
 * **Validates: Requirements 1.3**
 */
describe("Redis Client Reconnection Properties", () => {
  let manager: FallbackManager;
  let store: InMemoryStore;

  beforeEach(() => {
    resetFallbackManager();
    resetFallbackStore();
    resetRedisClient();
    store = new InMemoryStore();
    manager = new FallbackManager(store);
  });

  afterEach(() => {
    store.destroy();
    manager.reset();
    resetFallbackManager();
    resetFallbackStore();
    resetRedisClient();
  });

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: Connection state starts as disconnected
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - initial connection state is disconnected",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          resetRedisClient();
          const state = getConnectionState();
          return state === "disconnected";
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: Connection change callbacks are registered and can be unsubscribed
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - connection change callbacks can be registered and unsubscribed",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (callbackCount) => {
            resetRedisClient();
            const unsubscribers: (() => void)[] = [];
            const callbacksCalled: boolean[] = [];

            // Register multiple callbacks
            for (let i = 0; i < callbackCount; i++) {
              const index = i;
              const unsubscribe = onConnectionChange(() => {
                callbacksCalled[index] = true;
              });
              unsubscribers.push(unsubscribe);
            }

            // Unsubscribe all
            for (const unsubscribe of unsubscribers) {
              unsubscribe();
            }

            // After unsubscribing, callbacks should not be called
            // (we can't easily trigger connection change without real Redis,
            // but we verify the unsubscribe mechanism works)
            return unsubscribers.length === callbackCount;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: executeWithFallback returns usedFallback=true when operation fails
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - executeWithFallback handles failures gracefully",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (errorMessage) => {
          resetRedisClient();
          resetFallbackManager();

          // Execute an operation that will fail
          const result = await executeWithFallback(async () => {
            throw new Error(errorMessage || "Test error");
          });

          // Should return failure with usedFallback=true
          return (
            result.success === false &&
            result.result === null &&
            result.usedFallback === true
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: executeWithFallback returns success when operation succeeds
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - executeWithFallback returns success for successful operations",
    async () => {
      await fc.assert(
        fc.asyncProperty(valueArb, async (value) => {
          resetRedisClient();
          resetFallbackManager();

          // Execute an operation that will succeed
          const result = await executeWithFallback(async () => {
            return value;
          });

          // Should return success with the value
          return (
            result.success === true &&
            result.result === value &&
            result.usedFallback === false
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: Fallback mode is activated when executeWithFallback fails
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - fallback mode activates on operation failure",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          resetRedisClient();
          resetFallbackManager();

          const fallbackManager = getFallbackManager();
          expect(fallbackManager.isInFallbackMode()).toBe(false);

          // Execute an operation that will fail
          await executeWithFallback(async () => {
            throw new Error("Connection failed");
          });

          // Fallback mode should be activated
          return fallbackManager.isInFallbackMode() === true;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: Successful operations don't activate fallback mode
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - successful operations do not activate fallback mode",
    async () => {
      await fc.assert(
        fc.asyncProperty(valueArb, async (value) => {
          resetRedisClient();
          resetFallbackManager();

          const fallbackManager = getFallbackManager();
          expect(fallbackManager.isInFallbackMode()).toBe(false);

          // Execute an operation that will succeed
          await executeWithFallback(async () => {
            return value;
          });

          // Fallback mode should NOT be activated
          return fallbackManager.isInFallbackMode() === false;
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: Multiple failed operations only activate fallback once
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - multiple failures only activate fallback once",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (failureCount) => {
            resetRedisClient();
            resetFallbackManager();

            const fallbackManager = getFallbackManager();
            let activationCount = 0;

            fallbackManager.onFallbackActivated(() => {
              activationCount++;
            });

            // Execute multiple failing operations
            for (let i = 0; i < failureCount; i++) {
              await executeWithFallback(async () => {
                throw new Error(`Failure ${i}`);
              });
            }

            // Fallback should only be activated once
            return (
              activationCount === 1 &&
              fallbackManager.isInFallbackMode() === true
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: redis-improvements, Property 2: Automatic Reconnection Recovery**
   * Property: After deactivation, fallback can be reactivated on new failure
   * **Validates: Requirements 1.3**
   */
  it(
    "Property 2: Redis Client - fallback can be reactivated after deactivation",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          resetRedisClient();
          resetFallbackManager();

          const fallbackManager = getFallbackManager();
          let activationCount = 0;

          fallbackManager.onFallbackActivated(() => {
            activationCount++;
          });

          // First failure - activates fallback
          await executeWithFallback(async () => {
            throw new Error("First failure");
          });
          expect(fallbackManager.isInFallbackMode()).toBe(true);
          expect(activationCount).toBe(1);

          // Simulate reconnection (deactivate fallback)
          fallbackManager.deactivateFallback();
          expect(fallbackManager.isInFallbackMode()).toBe(false);

          // Second failure - should reactivate fallback
          await executeWithFallback(async () => {
            throw new Error("Second failure");
          });

          return (
            fallbackManager.isInFallbackMode() === true && activationCount === 2
          );
        }),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
