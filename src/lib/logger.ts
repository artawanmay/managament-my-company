/**
 * Environment-aware logging utility
 * 
 * In production: suppresses debug logs
 * In development: allows all logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

const formatMessage = (level: LogLevel, message: string, context?: LogContext): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

/**
 * Log debug information - suppressed in production
 */
export const logDebug = (message: string, context?: LogContext): void => {
  if (!isProduction()) {
    console.log(formatMessage('debug', message, context));
  }
};

/**
 * Log informational messages
 */
export const logInfo = (message: string, context?: LogContext): void => {
  console.log(formatMessage('info', message, context));
};

/**
 * Log warning messages
 */
export const logWarn = (message: string, context?: LogContext): void => {
  console.warn(formatMessage('warn', message, context));
};

/**
 * Log error messages
 */
export const logError = (message: string, context?: LogContext): void => {
  console.error(formatMessage('error', message, context));
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
