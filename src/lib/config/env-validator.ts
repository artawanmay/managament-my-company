/**
 * Environment Variable Validator
 *
 * Validates that all required environment variables are present and non-empty
 * before the application starts. This ensures early failure with clear error
 * messages rather than runtime failures.
 */

import { logError, logInfo } from "../logger";

/**
 * Required environment variables for production deployment
 * These must be set and non-empty for the application to start
 */
export const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Result of environment validation
 */
export interface EnvValidationResult {
  valid: boolean;
  missingVars: string[];
  errors: string[];
}

/**
 * Checks if a value is considered empty
 * A value is empty if it's undefined, null, or a string with only whitespace
 */
export function isEmptyValue(value: string | undefined | null): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  return value.trim().length === 0;
}

/**
 * Validates that all required environment variables are present and non-empty
 *
 * @param env - The environment object to validate (defaults to process.env)
 * @returns Validation result with missing variables and error messages
 */
export function validateEnvironment(
  env: Record<string, string | undefined> = process.env
): EnvValidationResult {
  const missingVars: string[] = [];
  const errors: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const value = env[varName];
    if (isEmptyValue(value)) {
      missingVars.push(varName);
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    valid: missingVars.length === 0,
    missingVars,
    errors,
  };
}

/**
 * Validates environment and throws an error if validation fails
 * Use this at application startup to ensure all required variables are set
 *
 * @param env - The environment object to validate (defaults to process.env)
 * @throws Error if any required environment variables are missing
 */
export function validateEnvironmentOrThrow(
  env: Record<string, string | undefined> = process.env
): void {
  const result = validateEnvironment(env);

  if (!result.valid) {
    for (const error of result.errors) {
      logError(error);
    }

    const errorMessage = `Environment validation failed. Missing variables: ${result.missingVars.join(", ")}`;
    throw new Error(errorMessage);
  }

  logInfo("Environment validation passed", {
    checkedVars: REQUIRED_ENV_VARS.length,
  });
}

/**
 * Gets a formatted error message for missing environment variables
 *
 * @param missingVars - Array of missing variable names
 * @returns Formatted error message
 */
export function formatMissingVarsError(missingVars: string[]): string {
  if (missingVars.length === 0) {
    return "";
  }

  if (missingVars.length === 1) {
    return `Missing required environment variable: ${missingVars[0]}`;
  }

  return `Missing required environment variables: ${missingVars.join(", ")}`;
}
