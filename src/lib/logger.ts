/**
 * Environment-aware logging utility
 *
 * In production: suppresses debug logs
 * In development: allows all logs
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production";
};

const formatMessage = (
  level: LogLevel,
  message: string,
  context?: LogContext
): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

/**
 * Log debug information - suppressed in production
 */
export const logDebug = (message: string, context?: LogContext): void => {
  if (!isProduction()) {
    console.log(formatMessage("debug", message, context));
  }
};

/**
 * Log informational messages
 */
export const logInfo = (message: string, context?: LogContext): void => {
  console.log(formatMessage("info", message, context));
};

/**
 * Log warning messages
 */
export const logWarn = (message: string, context?: LogContext): void => {
  console.warn(formatMessage("warn", message, context));
};

/**
 * Log error messages
 */
export const logError = (message: string, context?: LogContext): void => {
  console.error(formatMessage("error", message, context));
};

/**
 * Redact sensitive credentials from Redis URLs and connection strings.
 *
 * Handles various formats:
 * - redis://:password@host → redis://:[REDACTED]@host
 * - redis://user:password@host → redis://user:[REDACTED]@host
 * - rediss://:token@host → rediss://:[REDACTED]@host
 * - rediss://user:pass@host:port/db → rediss://user:[REDACTED]@host:port/db
 *
 * @param input - String that may contain Redis URLs with credentials
 * @returns String with credentials redacted
 */
export const redactCredentials = (input: string): string => {
  if (!input) {
    return input;
  }

  // Pattern matches redis:// or rediss:// URLs with optional user:password@ format
  // Captures: protocol, optional username, password/token, and the rest of the URL
  const redisUrlPattern = /(rediss?:\/\/)(?:([^:@]+):)?([^@]+)@/gi;

  return input.replace(
    redisUrlPattern,
    (_match, protocol, username, _password) => {
      if (username) {
        // Format: redis://user:password@host
        return `${protocol}${username}:[REDACTED]@`;
      } else {
        // Format: redis://:password@host (password-only auth)
        return `${protocol}:[REDACTED]@`;
      }
    }
  );
};

/**
 * Logger object for convenience
 */
export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
};
