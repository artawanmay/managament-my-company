/**
 * Date utility functions for converting between Date objects and Unix timestamps
 * Used because PostgreSQL schema stores timestamps as integers (Unix epoch seconds)
 */

/**
 * Convert a Date object to Unix timestamp (seconds since epoch)
 */
export function dateToUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp to Date object
 */
export function unixToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Get current Unix timestamp
 */
export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Convert Unix timestamp to ISO string
 */
export function unixToISOString(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Convert Date or null to Unix timestamp or null
 */
export function dateToUnixOrNull(date: Date | null): number | null {
  return date ? dateToUnix(date) : null;
}

/**
 * Convert Unix timestamp or null to Date or null
 */
export function unixToDateOrNull(timestamp: number | null): Date | null {
  return timestamp ? unixToDate(timestamp) : null;
}
