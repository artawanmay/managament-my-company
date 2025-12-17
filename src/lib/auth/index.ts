/**
 * Authentication library exports
 */
export { hashPassword, verifyPassword } from "./password";
export {
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  refreshSession,
  validateCsrfToken,
  generateSessionId,
  generateCsrfToken,
  type SessionData,
} from "./session";
export {
  csrfMiddleware,
  validateCsrfRequest,
  extractSessionIdFromCookie,
  extractCsrfToken,
  requiresCsrfProtection,
  setCsrfCookie,
  CSRF_HEADER,
  type CsrfValidationResult,
} from "./csrf";
export {
  recordFailedAttempt,
  isLocked,
  clearAttempts,
  getRemainingLockoutTime,
  getFailedAttemptCount,
  unlockAccount,
  setRedisClient,
  LOCKOUT_CONFIG,
} from "./lockout";
export {
  // Types
  type Role,
  type PermissionAction,
  type PermissionUser,
  // Constants
  roleValues,
  ROLE_HIERARCHY,
  PERMISSION_MATRIX,
  // Functions
  hasPermission,
  hasEqualOrHigherRole,
  canManageUsers,
  canManageUser,
  isProjectMember,
  canAccessProject,
  canManageProject,
  canAccessNote,
  canViewNoteSecret,
  getProjectMemberRole,
  canCreateTask,
  canEditTask,
  // Testing utilities
  setDatabase,
  resetDatabase,
  getDatabase,
} from "./permissions";

// Authorization middleware
export {
  // Middleware functions
  requireAuth,
  requireAuthWithCsrf,
  requireRole,
  requireRoles,
  requireProjectAccess,
  requireProjectManagement,
  // Helper functions
  createErrorResponse,
  handleAuthError,
  handleRoleError,
  handleProjectAccessError,
  // Types
  type AuthResult,
  type AuthError,
  type AuthMiddlewareResult,
  type RoleCheckResult,
  type RoleCheckError,
  type RoleMiddlewareResult,
  type ProjectAccessResult,
  type ProjectAccessError,
  type ProjectAccessMiddlewareResult,
} from "./middleware";
