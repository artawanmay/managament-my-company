/**
 * Authorization middleware for protected routes
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6 - Role-based access control
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usersSqlite, type Role } from "@/lib/db/schema/users";
import { validateSession } from "./session";
import { csrfMiddleware, extractSessionIdFromCookie } from "./csrf";
import {
  hasEqualOrHigherRole,
  canAccessProject,
  canManageProject,
  type PermissionUser,
} from "./permissions";
import { logError } from "@/lib/logger";

/**
 * Result of authentication middleware
 */
export interface AuthResult {
  success: true;
  user: PermissionUser & {
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  sessionId: string;
  csrfToken: string;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

export type AuthMiddlewareResult = AuthResult | AuthError;

/**
 * Result of role check middleware
 */
export interface RoleCheckResult {
  success: true;
}

export interface RoleCheckError {
  success: false;
  error: string;
  status: number;
}

export type RoleMiddlewareResult = RoleCheckResult | RoleCheckError;

/**
 * Result of project access middleware
 */
export interface ProjectAccessResult {
  success: true;
  canManage: boolean;
}

export interface ProjectAccessError {
  success: false;
  error: string;
  status: number;
}

export type ProjectAccessMiddlewareResult =
  | ProjectAccessResult
  | ProjectAccessError;

/**
 * Require authentication middleware
 * Validates the session and returns user information
 *
 * @param request - The incoming request
 * @returns AuthMiddlewareResult with user info or error
 *
 * @example
 * ```typescript
 * export async function GET({ request }) {
 *   const auth = await requireAuth(request);
 *   if (!auth.success) {
 *     return json({ error: auth.error }, { status: auth.status });
 *   }
 *   // auth.user is now available
 * }
 * ```
 */
export async function requireAuth(
  request: Request
): Promise<AuthMiddlewareResult> {
  try {
    // Extract session ID from cookie
    const cookieHeader = request.headers.get("cookie");
    const sessionId = extractSessionIdFromCookie(cookieHeader);

    if (!sessionId) {
      return {
        success: false,
        error: "Authentication required",
        status: 401,
      };
    }

    // Validate session
    const session = await validateSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: "Invalid or expired session",
        status: 401,
      };
    }

    // Fetch user data
    const users = await db
      .select({
        id: usersSqlite.id,
        email: usersSqlite.email,
        name: usersSqlite.name,
        role: usersSqlite.role,
        avatarUrl: usersSqlite.avatarUrl,
      })
      .from(usersSqlite)
      .where(eq(usersSqlite.id, session.userId))
      .limit(1);

    const user = users[0];

    if (!user) {
      return {
        success: false,
        error: "User not found",
        status: 401,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        avatarUrl: user.avatarUrl,
      },
      sessionId: session.id,
      csrfToken: session.csrfToken,
    };
  } catch (error) {
    logError("[requireAuth] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "Authentication error",
      status: 500,
    };
  }
}

/**
 * Require authentication with CSRF validation for mutation requests
 * Combines session validation with CSRF protection
 *
 * @param request - The incoming request
 * @returns AuthMiddlewareResult with user info or error
 */
export async function requireAuthWithCsrf(
  request: Request
): Promise<AuthMiddlewareResult> {
  // First validate authentication
  const authResult = await requireAuth(request);
  if (!authResult.success) {
    return authResult;
  }

  // Then validate CSRF for mutation methods
  const csrfResult = await csrfMiddleware(request);
  if (!csrfResult.valid) {
    return {
      success: false,
      error: csrfResult.error || "CSRF validation failed",
      status: 403,
    };
  }

  return authResult;
}

/**
 * Require a minimum role level
 * Must be called after requireAuth
 *
 * @param user - The authenticated user from requireAuth
 * @param minimumRole - The minimum role required
 * @returns RoleMiddlewareResult indicating success or error
 *
 * @example
 * ```typescript
 * export async function POST({ request }) {
 *   const auth = await requireAuth(request);
 *   if (!auth.success) {
 *     return json({ error: auth.error }, { status: auth.status });
 *   }
 *
 *   const roleCheck = requireRole(auth.user, 'ADMIN');
 *   if (!roleCheck.success) {
 *     return json({ error: roleCheck.error }, { status: roleCheck.status });
 *   }
 *   // User has ADMIN or higher role
 * }
 * ```
 */
export function requireRole(
  user: PermissionUser,
  minimumRole: Role
): RoleMiddlewareResult {
  if (!hasEqualOrHigherRole(user.role, minimumRole)) {
    return {
      success: false,
      error: `Insufficient permissions. Required role: ${minimumRole}`,
      status: 403,
    };
  }

  return { success: true };
}

/**
 * Require specific roles (any of the provided roles)
 * Must be called after requireAuth
 *
 * @param user - The authenticated user from requireAuth
 * @param allowedRoles - Array of allowed roles
 * @returns RoleMiddlewareResult indicating success or error
 *
 * @example
 * ```typescript
 * const roleCheck = requireRoles(auth.user, ['ADMIN', 'SUPER_ADMIN']);
 * ```
 */
export function requireRoles(
  user: PermissionUser,
  allowedRoles: Role[]
): RoleMiddlewareResult {
  if (!allowedRoles.includes(user.role)) {
    return {
      success: false,
      error: `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`,
      status: 403,
    };
  }

  return { success: true };
}

/**
 * Require access to a specific project
 * Must be called after requireAuth
 *
 * @param user - The authenticated user from requireAuth
 * @param projectId - The project ID to check access for
 * @returns ProjectAccessMiddlewareResult with access info or error
 *
 * @example
 * ```typescript
 * export async function GET({ request, params }) {
 *   const auth = await requireAuth(request);
 *   if (!auth.success) {
 *     return json({ error: auth.error }, { status: auth.status });
 *   }
 *
 *   const projectAccess = await requireProjectAccess(auth.user, params.projectId);
 *   if (!projectAccess.success) {
 *     return json({ error: projectAccess.error }, { status: projectAccess.status });
 *   }
 *
 *   // User can access the project
 *   // projectAccess.canManage indicates if they can modify it
 * }
 * ```
 */
export async function requireProjectAccess(
  user: PermissionUser,
  projectId: string
): Promise<ProjectAccessMiddlewareResult> {
  try {
    // Check if user can access the project
    const hasAccess = await canAccessProject(user, projectId);

    if (!hasAccess) {
      return {
        success: false,
        error: "You do not have access to this project",
        status: 403,
      };
    }

    // Also check if user can manage the project
    const canManage = await canManageProject(user, projectId);

    return {
      success: true,
      canManage,
    };
  } catch (error) {
    logError("[requireProjectAccess] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "Error checking project access",
      status: 500,
    };
  }
}

/**
 * Require management access to a specific project
 * Must be called after requireAuth
 *
 * @param user - The authenticated user from requireAuth
 * @param projectId - The project ID to check management access for
 * @returns ProjectAccessMiddlewareResult with access info or error
 */
export async function requireProjectManagement(
  user: PermissionUser,
  projectId: string
): Promise<ProjectAccessMiddlewareResult> {
  try {
    // Check if user can manage the project
    const canManage = await canManageProject(user, projectId);

    if (!canManage) {
      return {
        success: false,
        error: "You do not have permission to manage this project",
        status: 403,
      };
    }

    return {
      success: true,
      canManage: true,
    };
  } catch (error) {
    logError("[requireProjectManagement] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "Error checking project management access",
      status: 500,
    };
  }
}

/**
 * Helper to create a JSON error response
 *
 * @param error - Error message
 * @param status - HTTP status code
 * @returns Response object
 */
export function createErrorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Helper to handle auth middleware result and return error response if needed
 * Returns null if authentication succeeded
 *
 * @param result - The auth middleware result
 * @returns Response if error, null if success
 */
export function handleAuthError(result: AuthMiddlewareResult): Response | null {
  if (!result.success) {
    return createErrorResponse(result.error, result.status);
  }
  return null;
}

/**
 * Helper to handle role middleware result and return error response if needed
 * Returns null if role check succeeded
 *
 * @param result - The role middleware result
 * @returns Response if error, null if success
 */
export function handleRoleError(result: RoleMiddlewareResult): Response | null {
  if (!result.success) {
    return createErrorResponse(result.error, result.status);
  }
  return null;
}

/**
 * Helper to handle project access middleware result and return error response if needed
 * Returns null if access check succeeded
 *
 * @param result - The project access middleware result
 * @returns Response if error, null if success
 */
export function handleProjectAccessError(
  result: ProjectAccessMiddlewareResult
): Response | null {
  if (!result.success) {
    return createErrorResponse(result.error, result.status);
  }
  return null;
}
