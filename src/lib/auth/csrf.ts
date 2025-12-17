/**
 * CSRF protection middleware
 * Requirements: 1.6, 18.2 - CSRF token protection for mutation requests
 */
import { validateCsrfToken } from "./session";
import type { Database } from "@/lib/db";

// Allow injecting a different database for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbInstance = Database | any;

// CSRF token header name
export const CSRF_HEADER = "x-csrf-token";

// HTTP methods that require CSRF protection (mutations)
const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Extract session ID from request cookies
 * @param cookieHeader - The Cookie header value
 * @returns The session ID or null
 */
export function extractSessionIdFromCookie(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return cookies["session_id"] || null;
}

/**
 * Extract CSRF token from request headers
 * @param headers - Request headers
 * @returns The CSRF token or null
 */
export function extractCsrfToken(
  headers: Headers | Record<string, string>
): string | null {
  if (headers instanceof Headers) {
    return headers.get(CSRF_HEADER);
  }
  return headers[CSRF_HEADER] || headers[CSRF_HEADER.toLowerCase()] || null;
}

/**
 * Check if a request method requires CSRF protection
 * @param method - HTTP method
 * @returns True if CSRF protection is required
 */
export function requiresCsrfProtection(method: string): boolean {
  return MUTATION_METHODS.includes(method.toUpperCase());
}

/**
 * Validate CSRF token for a request
 * @param sessionId - The session ID
 * @param csrfToken - The CSRF token from the request
 * @param db - Optional database instance for testing
 * @returns Validation result
 */
export async function validateCsrfRequest(
  sessionId: string | null,
  csrfToken: string | null,
  db?: DbInstance
): Promise<CsrfValidationResult> {
  if (!sessionId) {
    return { valid: false, error: "No session found" };
  }

  if (!csrfToken) {
    return { valid: false, error: "CSRF token missing" };
  }

  const isValid = await validateCsrfToken(sessionId, csrfToken, db);

  if (!isValid) {
    return { valid: false, error: "Invalid CSRF token" };
  }

  return { valid: true };
}

/**
 * CSRF protection middleware for TanStack Start API routes
 * Use this to protect mutation endpoints
 *
 * @example
 * ```typescript
 * // In an API route handler
 * export async function POST(request: Request) {
 *   const csrfResult = await csrfMiddleware(request);
 *   if (!csrfResult.valid) {
 *     return new Response(JSON.stringify({ error: csrfResult.error }), {
 *       status: 403,
 *       headers: { 'Content-Type': 'application/json' }
 *     });
 *   }
 *   // Continue with the request...
 * }
 * ```
 */
export async function csrfMiddleware(
  request: Request,
  db?: DbInstance
): Promise<CsrfValidationResult> {
  const method = request.method;

  // Skip CSRF check for safe methods
  if (!requiresCsrfProtection(method)) {
    return { valid: true };
  }

  const cookieHeader = request.headers.get("cookie");
  const sessionId = extractSessionIdFromCookie(cookieHeader);
  const csrfToken = extractCsrfToken(request.headers);

  return validateCsrfRequest(sessionId, csrfToken, db);
}

/**
 * Create a CSRF-protected response helper
 * Sets the CSRF token in a cookie for the client to use
 */
export function setCsrfCookie(response: Response, csrfToken: string): Response {
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `csrf_token=${csrfToken}; Path=/; HttpOnly=false; SameSite=Strict`
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
