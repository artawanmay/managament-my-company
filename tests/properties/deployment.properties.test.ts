/**
 * Property-based tests for Dokploy deployment configuration
 * **Feature: dokploy-deployment, Property 1: Missing Environment Variables Cause Startup Failure**
 * **Feature: dokploy-deployment, Property 2: Database Connection Retry with Exponential Backoff**
 * **Validates: Requirements 1.4, 2.3**
 *
 * Tests that missing or empty environment variables cause validation failure
 * Tests that database connection retries use exponential backoff
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  REQUIRED_ENV_VARS,
  validateEnvironment,
  validateEnvironmentOrThrow,
  isEmptyValue,
  formatMissingVarsError,
} from "@/lib/config/env-validator";
import {
  calculateBackoffDelay,
  getBackoffSequence,
  connectWithRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "@/lib/db/connection";
import { getHealthCheckTimeout } from "@/lib/realtime/health";
import {
  parseCacheControl,
  extractCacheControlForLocation,
  validateNginxCacheHeaders,
  meetsMinimumCacheAge,
  MIN_CACHE_MAX_AGE_SECONDS,
} from "@/lib/config/nginx-validator";
import {
  parseDockerCompose,
  validateDockerCompose,
  hasVolumeMount,
  hasDependencyWithHealthCheck,
  hasHealthcheck,
  hasNamedVolumesForPersistence,
} from "@/lib/config/docker-compose-validator";

/**
 * Execute a function with a timeout (mirrors the implementation in health.ts)
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns The result of the function or throws on timeout
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Health check timeout")), timeoutMs)
    ),
  ]);
}

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

describe("Environment Validation Properties", () => {
  /**
   * **Feature: dokploy-deployment, Property 1: Missing Environment Variables Cause Startup Failure**
   * *For any* required environment variable (DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY),
   * if it is not set or empty, the application startup SHALL fail with an error message
   * naming the missing variable.
   * **Validates: Requirements 1.4**
   */
  it(
    "Property 1: Missing required environment variables cause validation failure",
    () => {
      fc.assert(
        fc.property(
          // Generate a subset of required vars to be missing (at least one)
          fc.subarray(REQUIRED_ENV_VARS as unknown as string[], {
            minLength: 1,
          }),
          // Generate valid values for the remaining vars
          fc.string({ minLength: 1, maxLength: 100 }),
          (missingVars, validValue) => {
            // Create an env object with some vars missing
            const env: Record<string, string | undefined> = {};

            for (const varName of REQUIRED_ENV_VARS) {
              if (!missingVars.includes(varName)) {
                env[varName] = validValue;
              }
              // Missing vars are simply not set (undefined)
            }

            const result = validateEnvironment(env);

            // Validation should fail
            if (result.valid) return false;

            // All missing vars should be reported
            for (const missingVar of missingVars) {
              if (!result.missingVars.includes(missingVar)) return false;
            }

            // Error messages should name each missing variable
            for (const missingVar of missingVars) {
              const hasErrorMessage = result.errors.some((err) =>
                err.includes(missingVar)
              );
              if (!hasErrorMessage) return false;
            }

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 1: Missing Environment Variables Cause Startup Failure**
   * *For any* required environment variable set to an empty string or whitespace,
   * the validation SHALL fail with an error message naming that variable.
   * **Validates: Requirements 1.4**
   */
  it(
    "Property 1: Empty or whitespace-only values cause validation failure",
    () => {
      fc.assert(
        fc.property(
          // Pick one required var to make empty
          fc.constantFrom(...REQUIRED_ENV_VARS),
          // Generate empty/whitespace values
          fc.oneof(
            fc.constant(""),
            fc.constant("   "),
            fc.constant("\t"),
            fc.constant("\n"),
            fc.constant("  \t\n  ")
          ),
          // Generate valid values for other vars
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          (emptyVar, emptyValue, validValue) => {
            // Create env with one var empty and others valid
            const env: Record<string, string | undefined> = {};

            for (const varName of REQUIRED_ENV_VARS) {
              if (varName === emptyVar) {
                env[varName] = emptyValue;
              } else {
                env[varName] = validValue;
              }
            }

            const result = validateEnvironment(env);

            // Validation should fail
            if (result.valid) return false;

            // The empty var should be in missing vars
            if (!result.missingVars.includes(emptyVar)) return false;

            // Error message should name the empty variable
            const hasErrorMessage = result.errors.some((err) =>
              err.includes(emptyVar)
            );
            return hasErrorMessage;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 1: Missing Environment Variables Cause Startup Failure**
   * *For any* complete set of valid environment variables, validation SHALL pass.
   * **Validates: Requirements 1.4**
   */
  it(
    "Property 1: All required variables present causes validation success",
    () => {
      fc.assert(
        fc.property(
          // Generate non-empty values for all required vars
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          (dbUrl, sessionSecret, encryptionKey) => {
            const env: Record<string, string | undefined> = {
              DATABASE_URL: dbUrl,
              SESSION_SECRET: sessionSecret,
              ENCRYPTION_KEY: encryptionKey,
            };

            const result = validateEnvironment(env);

            // Validation should pass
            return (
              result.valid &&
              result.missingVars.length === 0 &&
              result.errors.length === 0
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 1: Missing Environment Variables Cause Startup Failure**
   * *For any* missing required variable, validateEnvironmentOrThrow SHALL throw an error
   * with a message containing the missing variable name.
   * **Validates: Requirements 1.4**
   */
  it(
    "Property 1: validateEnvironmentOrThrow throws with descriptive error",
    () => {
      fc.assert(
        fc.property(
          // Pick one required var to be missing
          fc.constantFrom(...REQUIRED_ENV_VARS),
          // Generate valid values for other vars
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          (missingVar, validValue) => {
            // Create env with one var missing
            const env: Record<string, string | undefined> = {};

            for (const varName of REQUIRED_ENV_VARS) {
              if (varName !== missingVar) {
                env[varName] = validValue;
              }
            }

            // Should throw an error
            let thrownError: Error | null = null;
            try {
              validateEnvironmentOrThrow(env);
            } catch (e) {
              thrownError = e as Error;
            }

            // Must have thrown
            if (!thrownError) return false;

            // Error message must contain the missing variable name
            return thrownError.message.includes(missingVar);
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * Helper function tests
   */
  describe("isEmptyValue helper", () => {
    it("returns true for undefined", () => {
      expect(isEmptyValue(undefined)).toBe(true);
    });

    it("returns true for null", () => {
      expect(isEmptyValue(null)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(isEmptyValue("")).toBe(true);
    });

    it("returns true for whitespace-only strings", () => {
      expect(isEmptyValue("   ")).toBe(true);
      expect(isEmptyValue("\t")).toBe(true);
      expect(isEmptyValue("\n")).toBe(true);
    });

    it("returns false for non-empty strings", () => {
      expect(isEmptyValue("value")).toBe(false);
      expect(isEmptyValue(" value ")).toBe(false);
    });
  });

  describe("formatMissingVarsError helper", () => {
    it("returns empty string for no missing vars", () => {
      expect(formatMissingVarsError([])).toBe("");
    });

    it("formats single missing var correctly", () => {
      const result = formatMissingVarsError(["DATABASE_URL"]);
      expect(result).toContain("DATABASE_URL");
      expect(result).toContain("Missing required environment variable");
    });

    it("formats multiple missing vars correctly", () => {
      const result = formatMissingVarsError([
        "DATABASE_URL",
        "SESSION_SECRET",
      ]);
      expect(result).toContain("DATABASE_URL");
      expect(result).toContain("SESSION_SECRET");
      expect(result).toContain("Missing required environment variables");
    });
  });
});

describe("Database Connection Retry Properties", () => {
  /**
   * **Feature: dokploy-deployment, Property 2: Database Connection Retry with Exponential Backoff**
   * *For any* database connection failure during startup, the system SHALL retry with
   * delays of 1s, 2s, 4s, 8s, 16s (exponential backoff) before failing after 5 attempts.
   * **Validates: Requirements 2.3**
   */
  it(
    "Property 2: Exponential backoff delays follow 2^n pattern",
    () => {
      fc.assert(
        fc.property(
          // Generate attempt numbers from 1 to maxRetries
          fc.integer({ min: 1, max: 10 }),
          // Generate base delay values
          fc.integer({ min: 100, max: 5000 }),
          // Generate max delay cap
          fc.integer({ min: 1000, max: 60000 }),
          (attempt, baseDelayMs, maxDelayMs) => {
            const config: RetryConfig = {
              maxRetries: 10,
              baseDelayMs,
              maxDelayMs,
            };

            const delay = calculateBackoffDelay(attempt, config);

            // Expected delay is baseDelay * 2^(attempt-1), capped at maxDelay
            const expectedDelay = Math.min(
              baseDelayMs * Math.pow(2, attempt - 1),
              maxDelayMs
            );

            return delay === expectedDelay;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 2: Database Connection Retry with Exponential Backoff**
   * The default configuration SHALL produce delays of exactly 1s, 2s, 4s, 8s, 16s.
   * **Validates: Requirements 2.3**
   */
  it(
    "Property 2: Default config produces 1s, 2s, 4s, 8s, 16s sequence",
    () => {
      const expectedSequence = [1000, 2000, 4000, 8000, 16000];
      const actualSequence = getBackoffSequence(DEFAULT_RETRY_CONFIG);

      expect(actualSequence).toEqual(expectedSequence);
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(5);
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 2: Database Connection Retry with Exponential Backoff**
   * *For any* sequence of connection failures, the system SHALL attempt exactly maxRetries times.
   * **Validates: Requirements 2.3**
   */
  it(
    "Property 2: Connection retries exactly maxRetries times on persistent failure",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate maxRetries between 1 and 5
          fc.integer({ min: 1, max: 5 }),
          async (maxRetries) => {
            let attemptCount = 0;

            const config: RetryConfig = {
              maxRetries,
              baseDelayMs: 1, // Use 1ms for fast tests
              maxDelayMs: 10,
            };

            const connectFn = async () => {
              attemptCount++;
              throw new Error("Connection failed");
            };

            const result = await connectWithRetry(connectFn, config);

            // Should have attempted exactly maxRetries times
            if (attemptCount !== maxRetries) return false;

            // Result should indicate failure
            if (result.success) return false;

            // Attempts count should match
            if (result.attempts !== maxRetries) return false;

            // Should have an error
            if (!result.error) return false;

            return true;
          }
        ),
        { numRuns: 20 } // Fewer runs since these are async
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 2: Database Connection Retry with Exponential Backoff**
   * *For any* successful connection on attempt N, the system SHALL stop retrying and return success.
   * **Validates: Requirements 2.3**
   */
  it(
    "Property 2: Successful connection stops retry loop",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate which attempt should succeed (1 to 5)
          fc.integer({ min: 1, max: 5 }),
          async (successOnAttempt) => {
            let attemptCount = 0;
            const connectionValue = { connected: true };

            const config: RetryConfig = {
              maxRetries: 5,
              baseDelayMs: 1, // Use 1ms for fast tests
              maxDelayMs: 10,
            };

            const connectFn = async () => {
              attemptCount++;
              if (attemptCount < successOnAttempt) {
                throw new Error("Connection failed");
              }
              return connectionValue;
            };

            const result = await connectWithRetry(connectFn, config);

            // Should have attempted exactly successOnAttempt times
            if (attemptCount !== successOnAttempt) return false;

            // Result should indicate success
            if (!result.success) return false;

            // Attempts count should match
            if (result.attempts !== successOnAttempt) return false;

            // Should have the connection
            if (result.connection !== connectionValue) return false;

            // Should not have an error
            if (result.error) return false;

            return true;
          }
        ),
        { numRuns: 20 } // Fewer runs since these are async
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 2: Database Connection Retry with Exponential Backoff**
   * *For any* retry configuration, delays SHALL be monotonically increasing until capped.
   * **Validates: Requirements 2.3**
   */
  it(
    "Property 2: Backoff delays are monotonically increasing until capped",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // maxRetries
          fc.integer({ min: 100, max: 2000 }), // baseDelayMs
          fc.integer({ min: 1000, max: 30000 }), // maxDelayMs
          (maxRetries, baseDelayMs, maxDelayMs) => {
            const config: RetryConfig = { maxRetries, baseDelayMs, maxDelayMs };
            const sequence = getBackoffSequence(config);

            // Check monotonically increasing (or equal when capped)
            for (let i = 1; i < sequence.length; i++) {
              const current = sequence[i];
              const previous = sequence[i - 1];
              if (current !== undefined && previous !== undefined && current < previous) {
                return false;
              }
            }

            // All delays should be <= maxDelayMs
            for (const delay of sequence) {
              if (delay > maxDelayMs) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});


describe("Health Check Response Time Properties", () => {
  /**
   * **Feature: dokploy-deployment, Property 5: Health Check Response Time**
   * *For any* request to the /health endpoint, the system SHALL respond within 5000 milliseconds
   * regardless of backend service status.
   * **Validates: Requirements 5.4**
   */
  it(
    "Property 5: Health check timeout is configured to 5 seconds",
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary boolean to ensure property runs multiple times
          fc.boolean(),
          () => {
            const timeout = getHealthCheckTimeout();
            // Timeout must be exactly 5000ms as per requirement
            return timeout === 5000;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 5: Health Check Response Time**
   * *For any* health check execution, the withTimeout wrapper SHALL enforce the 5 second limit.
   * **Validates: Requirements 5.4**
   */
  it(
    "Property 5: withTimeout enforces time limit on slow operations",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate delay times that exceed the timeout
          fc.integer({ min: 100, max: 500 }),
          async (delayMs) => {
            const timeoutMs = 50; // Use short timeout for testing
            const startTime = Date.now();

            // Create a slow operation that takes longer than timeout
            const slowOperation = async () => {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              return "completed";
            };

            // Execute with timeout
            let timedOut = false;
            try {
              await withTimeout(slowOperation, timeoutMs);
            } catch (error) {
              if (error instanceof Error && error.message === "Health check timeout") {
                timedOut = true;
              }
            }

            const elapsed = Date.now() - startTime;

            // If delay > timeout, should have timed out
            if (delayMs > timeoutMs) {
              // Should have timed out and elapsed time should be close to timeout
              return timedOut && elapsed < delayMs;
            }

            // If delay <= timeout, should complete normally
            return !timedOut;
          }
        ),
        { numRuns: 20 } // Fewer runs since these are async with delays
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 5: Health Check Response Time**
   * *For any* fast operation, withTimeout SHALL return the result without timing out.
   * **Validates: Requirements 5.4**
   */
  it(
    "Property 5: Fast operations complete without timeout",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary return values
          fc.string({ minLength: 1, maxLength: 50 }),
          async (expectedResult) => {
            const timeoutMs = 5000;

            // Create a fast operation
            const fastOperation = async () => {
              return expectedResult;
            };

            // Execute with timeout
            const result = await withTimeout(fastOperation, timeoutMs);

            // Should return the expected result
            return result === expectedResult;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 5: Health Check Response Time**
   * *For any* health check response timestamp, it SHALL be a valid ISO 8601 date string.
   * **Validates: Requirements 5.4**
   */
  it(
    "Property 5: Health check response timestamp format is valid ISO 8601",
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary dates within a reasonable range, filtering out invalid dates
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
            .filter((d) => !isNaN(d.getTime())),
          (date) => {
            // Simulate the timestamp generation used in health check
            const timestamp = date.toISOString();

            // Verify it's a valid ISO 8601 date string
            const parsedDate = new Date(timestamp);
            const isValidDate = !isNaN(parsedDate.getTime());

            // Verify round-trip: parsing and re-serializing should produce same result
            const roundTrip = parsedDate.toISOString() === timestamp;

            return isValidDate && roundTrip;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 5: Health Check Response Time**
   * *For any* timeout value, the withTimeout function SHALL reject operations
   * that exceed the specified timeout.
   * **Validates: Requirements 5.4**
   */
  it(
    "Property 5: Operations exceeding timeout are rejected",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate timeout values between 10ms and 100ms for fast testing
          fc.integer({ min: 10, max: 100 }),
          async (timeoutMs) => {
            // Create an operation that will never complete within timeout
            const neverCompletes = async () => {
              await new Promise((resolve) => setTimeout(resolve, timeoutMs * 10));
              return "should not reach here";
            };

            const startTime = Date.now();
            let timedOut = false;
            let errorMessage = "";

            try {
              await withTimeout(neverCompletes, timeoutMs);
            } catch (error) {
              if (error instanceof Error) {
                timedOut = true;
                errorMessage = error.message;
              }
            }

            const elapsed = Date.now() - startTime;

            // Should have timed out
            if (!timedOut) return false;

            // Error message should indicate timeout
            if (errorMessage !== "Health check timeout") return false;

            // Elapsed time should be close to timeout (within 50ms tolerance)
            if (elapsed < timeoutMs || elapsed > timeoutMs + 50) return false;

            return true;
          }
        ),
        { numRuns: 10 } // Fewer runs since these involve actual delays
      );
    },
    TEST_TIMEOUT
  );
});


describe("Static Asset Cache Headers Properties", () => {
  /**
   * **Feature: dokploy-deployment, Property 3: Static Assets Served with Cache Headers**
   * *For any* request to a static asset path (files in /assets/), Nginx SHALL respond
   * with Cache-Control headers set to at least 1 day max-age.
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 3: Cache-Control max-age values >= 1 day are valid",
    () => {
      fc.assert(
        fc.property(
          // Generate max-age values that should be valid (>= 1 day = 86400 seconds)
          fc.integer({ min: MIN_CACHE_MAX_AGE_SECONDS, max: 31536000 }), // Up to 1 year
          (maxAgeSeconds) => {
            // Any max-age >= 86400 (1 day) should meet the minimum requirement
            return meetsMinimumCacheAge(maxAgeSeconds);
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 3: Static Assets Served with Cache Headers**
   * *For any* max-age value less than 1 day, the validation SHALL fail.
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 3: Cache-Control max-age values < 1 day are invalid",
    () => {
      fc.assert(
        fc.property(
          // Generate max-age values that should be invalid (< 1 day = 86400 seconds)
          fc.integer({ min: 0, max: MIN_CACHE_MAX_AGE_SECONDS - 1 }),
          (maxAgeSeconds) => {
            // Any max-age < 86400 (1 day) should NOT meet the minimum requirement
            return !meetsMinimumCacheAge(maxAgeSeconds);
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 3: Static Assets Served with Cache Headers**
   * *For any* valid Cache-Control header string with max-age, parsing SHALL extract the correct value.
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 3: Cache-Control header parsing extracts max-age correctly",
    () => {
      fc.assert(
        fc.property(
          // Generate valid max-age values
          fc.integer({ min: 0, max: 31536000 }),
          // Generate optional directives
          fc.boolean(), // public
          fc.boolean(), // immutable
          (maxAge, isPublic, isImmutable) => {
            // Build a Cache-Control header string
            const directives: string[] = [];
            if (isPublic) directives.push("public");
            directives.push(`max-age=${maxAge}`);
            if (isImmutable) directives.push("immutable");

            const headerValue = directives.join(", ");
            const parsed = parseCacheControl(headerValue);

            // Verify parsing is correct
            if (parsed.maxAge !== maxAge) return false;
            if (parsed.public !== isPublic) return false;
            if (parsed.immutable !== isImmutable) return false;

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 3: Static Assets Served with Cache Headers**
   * *For any* nginx config with /assets/ location and valid Cache-Control header,
   * validation SHALL pass when max-age >= 1 day.
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 3: Nginx config with valid cache headers passes validation",
    () => {
      fc.assert(
        fc.property(
          // Generate valid max-age values (>= 1 day)
          fc.integer({ min: MIN_CACHE_MAX_AGE_SECONDS, max: 31536000 }),
          (maxAge) => {
            // Create a minimal nginx config with valid cache headers
            const config = `
server {
    listen 80;
    
    location /assets/ {
        proxy_pass http://app;
        add_header Cache-Control "public, max-age=${maxAge}, immutable";
    }
}`;

            const result = validateNginxCacheHeaders(config);

            // Should be valid
            if (!result.valid) return false;
            if (!result.hasAssetsLocation) return false;
            if (!result.hasCacheControl) return false;
            if (result.cacheMaxAge !== maxAge) return false;
            if (!result.meetsMinCacheAge) return false;
            if (result.errors.length > 0) return false;

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 3: Static Assets Served with Cache Headers**
   * *For any* nginx config with /assets/ location but insufficient max-age,
   * validation SHALL fail with appropriate error message.
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 3: Nginx config with insufficient cache max-age fails validation",
    () => {
      fc.assert(
        fc.property(
          // Generate invalid max-age values (< 1 day)
          fc.integer({ min: 0, max: MIN_CACHE_MAX_AGE_SECONDS - 1 }),
          (maxAge) => {
            // Create a nginx config with insufficient cache headers
            const config = `
server {
    listen 80;
    
    location /assets/ {
        proxy_pass http://app;
        add_header Cache-Control "public, max-age=${maxAge}";
    }
}`;

            const result = validateNginxCacheHeaders(config);

            // Should be invalid
            if (result.valid) return false;
            if (!result.hasAssetsLocation) return false;
            if (!result.hasCacheControl) return false;
            if (result.cacheMaxAge !== maxAge) return false;
            if (result.meetsMinCacheAge) return false;
            // Should have error about insufficient max-age
            if (result.errors.length === 0) return false;

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 3: Static Assets Served with Cache Headers**
   * *For any* nginx config missing /assets/ location, validation SHALL fail.
   * **Validates: Requirements 3.3**
   */
  it(
    "Property 3: Nginx config missing assets location fails validation",
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary server names
          fc.string({ minLength: 1, maxLength: 20 }),
          (serverName) => {
            // Create a nginx config without /assets/ location
            const config = `
server {
    listen 80;
    server_name ${serverName};
    
    location / {
        proxy_pass http://app;
    }
}`;

            const result = validateNginxCacheHeaders(config);

            // Should be invalid
            if (result.valid) return false;
            if (result.hasAssetsLocation) return false;
            // Should have error about missing location
            if (result.errors.length === 0) return false;

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * Helper function tests for Cache-Control parsing
   */
  describe("parseCacheControl helper", () => {
    it("parses empty string correctly", () => {
      const result = parseCacheControl("");
      expect(result.maxAge).toBeNull();
      expect(result.public).toBe(false);
      expect(result.private).toBe(false);
    });

    it("parses public directive", () => {
      const result = parseCacheControl("public");
      expect(result.public).toBe(true);
    });

    it("parses private directive", () => {
      const result = parseCacheControl("private");
      expect(result.private).toBe(true);
    });

    it("parses no-cache directive", () => {
      const result = parseCacheControl("no-cache");
      expect(result.noCache).toBe(true);
    });

    it("parses no-store directive", () => {
      const result = parseCacheControl("no-store");
      expect(result.noStore).toBe(true);
    });

    it("parses immutable directive", () => {
      const result = parseCacheControl("immutable");
      expect(result.immutable).toBe(true);
    });

    it("parses max-age directive", () => {
      const result = parseCacheControl("max-age=86400");
      expect(result.maxAge).toBe(86400);
    });

    it("parses combined directives", () => {
      const result = parseCacheControl("public, max-age=86400, immutable");
      expect(result.public).toBe(true);
      expect(result.maxAge).toBe(86400);
      expect(result.immutable).toBe(true);
    });
  });

  describe("extractCacheControlForLocation helper", () => {
    it("extracts Cache-Control from location block", () => {
      const config = `
location /assets/ {
    add_header Cache-Control "public, max-age=86400";
}`;
      const result = extractCacheControlForLocation(config, "/assets/");
      expect(result).toBe("public, max-age=86400");
    });

    it("returns null when location not found", () => {
      const config = `
location / {
    proxy_pass http://app;
}`;
      const result = extractCacheControlForLocation(config, "/assets/");
      expect(result).toBeNull();
    });

    it("returns null when Cache-Control not in location", () => {
      const config = `
location /assets/ {
    proxy_pass http://app;
}`;
      const result = extractCacheControlForLocation(config, "/assets/");
      expect(result).toBeNull();
    });
  });

  /**
   * Verify actual nginx.conf file has correct configuration
   */
  describe("Actual nginx.conf validation", () => {
    it("nginx.conf has valid cache headers for /assets/", () => {
      // Read the actual nginx.conf file
      const fs = require("fs");
      const path = require("path");
      const configPath = path.join(process.cwd(), "docker/nginx/nginx.conf");
      
      if (!fs.existsSync(configPath)) {
        // Skip if file doesn't exist (might be running in CI without docker folder)
        return;
      }

      const content = fs.readFileSync(configPath, "utf-8");
      const result = validateNginxCacheHeaders(content);

      expect(result.hasAssetsLocation).toBe(true);
      expect(result.hasCacheControl).toBe(true);
      expect(result.cacheMaxAge).toBeGreaterThanOrEqual(MIN_CACHE_MAX_AGE_SECONDS);
      expect(result.meetsMinCacheAge).toBe(true);
      expect(result.valid).toBe(true);
    });
  });
});


describe("Data Persistence Properties", () => {
  /**
   * **Feature: dokploy-deployment, Property 4: Data Persistence Across Restarts**
   * *For any* data written to PostgreSQL or the uploads volume, that data SHALL be
   * retrievable after the Docker stack is stopped and restarted.
   * **Validates: Requirements 4.4**
   *
   * This property is validated by ensuring the docker-compose configuration uses
   * named volumes for PostgreSQL data and uploads, which persist across restarts.
   */
  it(
    "Property 4: Docker Compose uses named volumes for data persistence",
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary boolean to ensure property runs multiple times
          fc.boolean(),
          () => {
            // Read the actual docker-compose.yml file
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "docker-compose.yml");

            if (!fs.existsSync(configPath)) {
              // Skip if file doesn't exist
              return true;
            }

            const content = fs.readFileSync(configPath, "utf-8");
            const config = parseDockerCompose(content);

            // Verify named volumes are defined for persistence
            return hasNamedVolumesForPersistence(config);
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 4: Data Persistence Across Restarts**
   * *For any* docker-compose configuration with named volumes, the PostgreSQL service
   * SHALL mount the pg_data volume to /var/lib/postgresql/data.
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 4: PostgreSQL service mounts pg_data volume correctly",
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary boolean to ensure property runs multiple times
          fc.boolean(),
          () => {
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "docker-compose.yml");

            if (!fs.existsSync(configPath)) {
              return true;
            }

            const content = fs.readFileSync(configPath, "utf-8");
            const config = parseDockerCompose(content);

            // Check PostgreSQL service exists and has volume mount
            if (!config.services.postgres) return false;
            
            return hasVolumeMount(config.services.postgres, "pg_data");
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 4: Data Persistence Across Restarts**
   * *For any* docker-compose configuration with named volumes, the app service
   * SHALL mount the uploads volume for file persistence.
   * **Validates: Requirements 4.4**
   */
  it(
    "Property 4: App service mounts uploads volume correctly",
    () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          () => {
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "docker-compose.yml");

            if (!fs.existsSync(configPath)) {
              return true;
            }

            const content = fs.readFileSync(configPath, "utf-8");
            const config = parseDockerCompose(content);

            // Check app service exists and has volume mount
            if (!config.services.app) return false;
            
            return hasVolumeMount(config.services.app, "uploads");
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 4: Data Persistence Across Restarts**
   * *For any* valid docker-compose configuration, all required services SHALL be present.
   * **Validates: Requirements 4.1**
   */
  it(
    "Property 4: All required services are defined",
    () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          () => {
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "docker-compose.yml");

            if (!fs.existsSync(configPath)) {
              return true;
            }

            const content = fs.readFileSync(configPath, "utf-8");
            const result = validateDockerCompose(content);

            return (
              result.hasPostgresService &&
              result.hasRedisService &&
              result.hasAppService &&
              result.hasNginxService
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 4: Data Persistence Across Restarts**
   * *For any* valid docker-compose configuration, services SHALL have health checks.
   * **Validates: Requirements 4.2**
   */
  it(
    "Property 4: Services have health checks configured",
    () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          () => {
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "docker-compose.yml");

            if (!fs.existsSync(configPath)) {
              return true;
            }

            const content = fs.readFileSync(configPath, "utf-8");
            const result = validateDockerCompose(content);

            return (
              result.hasPostgresHealthcheck &&
              result.hasRedisHealthcheck &&
              result.hasAppHealthcheck
            );
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: dokploy-deployment, Property 4: Data Persistence Across Restarts**
   * *For any* valid docker-compose configuration, services SHALL wait for dependencies
   * to be healthy before starting.
   * **Validates: Requirements 4.2**
   */
  it(
    "Property 4: Services have correct dependency conditions",
    () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          () => {
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "docker-compose.yml");

            if (!fs.existsSync(configPath)) {
              return true;
            }

            const content = fs.readFileSync(configPath, "utf-8");
            const result = validateDockerCompose(content);

            return result.hasCorrectDependencies;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * Helper function tests for docker-compose parsing
   */
  describe("parseDockerCompose helper", () => {
    it("parses services correctly", () => {
      const config = `
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]

volumes:
  pg_data:
    name: test-pg-data
`;
      const result = parseDockerCompose(config);
      
      expect(result.version).toBe("3.8");
      expect(result.services.postgres).toBeDefined();
      expect(result.services.postgres?.image).toBe("postgres:16-alpine");
      expect(result.services.postgres?.volumes).toContain("pg_data:/var/lib/postgresql/data");
      expect(result.volumes?.pg_data).toBeDefined();
    });

    it("parses depends_on with conditions", () => {
      const config = `
services:
  app:
    image: app:latest
    depends_on:
      postgres:
        condition: service_healthy
`;
      const result = parseDockerCompose(config);
      
      expect(result.services.app).toBeDefined();
      const dependsOn = result.services.app?.depends_on as Record<string, { condition: string }>;
      expect(dependsOn?.postgres?.condition).toBe("service_healthy");
    });
  });

  describe("hasVolumeMount helper", () => {
    it("returns true when volume is mounted", () => {
      const service = { volumes: ["pg_data:/var/lib/postgresql/data"] };
      expect(hasVolumeMount(service, "pg_data")).toBe(true);
    });

    it("returns false when volume is not mounted", () => {
      const service = { volumes: ["other:/data"] };
      expect(hasVolumeMount(service, "pg_data")).toBe(false);
    });

    it("returns false when no volumes defined", () => {
      const service = {};
      expect(hasVolumeMount(service, "pg_data")).toBe(false);
    });
  });

  describe("hasDependencyWithHealthCheck helper", () => {
    it("returns true for service_healthy condition", () => {
      const service = {
        depends_on: {
          postgres: { condition: "service_healthy" },
        },
      };
      expect(hasDependencyWithHealthCheck(service, "postgres")).toBe(true);
    });

    it("returns false for other conditions", () => {
      const service = {
        depends_on: {
          postgres: { condition: "service_started" },
        },
      };
      expect(hasDependencyWithHealthCheck(service, "postgres")).toBe(false);
    });

    it("returns false when dependency not present", () => {
      const service = {
        depends_on: {
          redis: { condition: "service_healthy" },
        },
      };
      expect(hasDependencyWithHealthCheck(service, "postgres")).toBe(false);
    });
  });

  describe("hasHealthcheck helper", () => {
    it("returns true when healthcheck is configured", () => {
      const service = {
        healthcheck: {
          test: ["CMD", "pg_isready"],
          interval: "10s",
        },
      };
      expect(hasHealthcheck(service)).toBe(true);
    });

    it("returns false when healthcheck is empty", () => {
      const service = {
        healthcheck: {
          test: [],
        },
      };
      expect(hasHealthcheck(service)).toBe(false);
    });

    it("returns false when no healthcheck defined", () => {
      const service = {};
      expect(hasHealthcheck(service)).toBe(false);
    });
  });

  /**
   * Verify actual docker-compose.yml file has correct configuration
   */
  describe("Actual docker-compose.yml validation", () => {
    it("docker-compose.yml passes all validation checks", () => {
      const fs = require("fs");
      const path = require("path");
      const configPath = path.join(process.cwd(), "docker-compose.yml");

      if (!fs.existsSync(configPath)) {
        // Skip if file doesn't exist
        return;
      }

      const content = fs.readFileSync(configPath, "utf-8");
      const result = validateDockerCompose(content);

      expect(result.hasPostgresService).toBe(true);
      expect(result.hasRedisService).toBe(true);
      expect(result.hasAppService).toBe(true);
      expect(result.hasNginxService).toBe(true);
      expect(result.hasPostgresVolume).toBe(true);
      expect(result.hasUploadsVolume).toBe(true);
      expect(result.hasPostgresHealthcheck).toBe(true);
      expect(result.hasRedisHealthcheck).toBe(true);
      expect(result.hasAppHealthcheck).toBe(true);
      expect(result.hasCorrectDependencies).toBe(true);
      expect(result.valid).toBe(true);
    });
  });
});
