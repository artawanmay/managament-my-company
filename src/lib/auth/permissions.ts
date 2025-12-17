/**
 * Permission system for role-based access control
 * Implements Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { eq, and } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { projectMembersSqlite } from "@/lib/db/schema/project-members";
import { notesSqlite } from "@/lib/db/schema/notes";
import { projectsSqlite } from "@/lib/db/schema/projects";
import type { Role } from "@/lib/db/schema/users";

// Re-export Role type for convenience
export type { Role } from "@/lib/db/schema/users";
export { roleValues } from "@/lib/db/schema/users";

// Allow injecting a custom database for testing
let _db: Database = defaultDb;

/**
 * Set the database instance (for testing purposes)
 */
export function setDatabase(database: Database): void {
  _db = database;
}

/**
 * Reset to the default database
 */
export function resetDatabase(): void {
  _db = defaultDb;
}

/**
 * Get the current database instance
 */
export function getDatabase(): Database {
  return _db;
}

/**
 * Role hierarchy - higher index = more permissions
 * SUPER_ADMIN > MANAGER > MEMBER > GUEST (ADMIN removed)
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  GUEST: 0,
  MEMBER: 1,
  MANAGER: 2,
  SUPER_ADMIN: 3,
};

/**
 * Permission actions that can be performed in the system
 */
export type PermissionAction =
  | "manage_all_users"
  | "manage_users"
  | "manage_clients"
  | "manage_projects"
  | "manage_assigned_projects"
  | "create_tasks"
  | "edit_tasks"
  | "view_secrets"
  | "read_only";

/**
 * Permission matrix defining what each role can do
 * Requirements 2.2, 2.3, 2.4, 2.5, 2.6
 */
export const PERMISSION_MATRIX: Record<Role, Set<PermissionAction>> = {
  SUPER_ADMIN: new Set([
    "manage_all_users",
    "manage_users",
    "manage_clients",
    "manage_projects",
    "manage_assigned_projects",
    "create_tasks",
    "edit_tasks",
    "view_secrets",
  ]),
  MANAGER: new Set([
    "manage_assigned_projects",
    "create_tasks",
    "edit_tasks",
    "view_secrets",
  ]),
  MEMBER: new Set(["create_tasks", "edit_tasks"]),
  GUEST: new Set(["read_only"]),
};

/**
 * User interface for permission checks
 */
export interface PermissionUser {
  id: string;
  role: Role;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, action: PermissionAction): boolean {
  return PERMISSION_MATRIX[role]?.has(action) ?? false;
}

/**
 * Check if roleA has equal or higher privileges than roleB
 */
export function hasEqualOrHigherRole(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Check if a user can manage other users
 * SUPER_ADMIN can manage all users
 * ADMIN can manage users except SUPER_ADMIN
 * Requirements 2.2, 2.3
 */
export function canManageUsers(user: PermissionUser): boolean {
  return (
    hasPermission(user.role, "manage_users") ||
    hasPermission(user.role, "manage_all_users")
  );
}

/**
 * Check if a user can manage a specific target user based on role hierarchy
 * Only SUPER_ADMIN can manage users (ADMIN role removed)
 * Requirements 2.2, 2.3
 */
export function canManageUser(
  user: PermissionUser,
  _targetUserRole: Role
): boolean {
  if (user.role === "SUPER_ADMIN") {
    return true;
  }
  return false;
}

/**
 * Check if a user is a member of a specific project
 * Requirements 4.4, 4.5
 */
export async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const members = await _db
    .select({ id: projectMembersSqlite.id })
    .from(projectMembersSqlite)
    .where(
      and(
        eq(projectMembersSqlite.userId, userId),
        eq(projectMembersSqlite.projectId, projectId)
      )
    )
    .limit(1);

  return members.length > 0;
}

/**
 * Check if a user can access a project
 * SUPER_ADMIN can access all projects
 * MANAGER, MEMBER, GUEST can only access projects they are members of
 * Requirements 4.2, 4.4, 4.5
 */
export async function canAccessProject(
  user: PermissionUser,
  projectId: string
): Promise<boolean> {
  // SUPER_ADMIN can access all projects
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // Check if user is the project manager
  const projects = await _db
    .select({ managerId: projectsSqlite.managerId })
    .from(projectsSqlite)
    .where(eq(projectsSqlite.id, projectId))
    .limit(1);

  const project = projects[0];
  if (project && project.managerId === user.id) {
    return true;
  }

  // Check if user is a project member
  return isProjectMember(user.id, projectId);
}

/**
 * Check if a user can manage a project (add/remove members, edit project)
 * SUPER_ADMIN can manage all projects
 * MANAGER can manage projects they are assigned to as manager
 * Requirements 2.4, 4.4, 4.5
 */
export async function canManageProject(
  user: PermissionUser,
  projectId: string
): Promise<boolean> {
  // SUPER_ADMIN can manage all projects
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // MANAGER can manage projects they are the manager of
  if (user.role === "MANAGER") {
    const projects = await _db
      .select({ managerId: projectsSqlite.managerId })
      .from(projectsSqlite)
      .where(eq(projectsSqlite.id, projectId))
      .limit(1);

    const project = projects[0];
    if (project && project.managerId === user.id) {
      return true;
    }

    // Also check if they have MANAGER role in project_members
    const members = await _db
      .select({ role: projectMembersSqlite.role })
      .from(projectMembersSqlite)
      .where(
        and(
          eq(projectMembersSqlite.userId, user.id),
          eq(projectMembersSqlite.projectId, projectId)
        )
      )
      .limit(1);

    const member = members[0];
    return member !== undefined && member.role === "MANAGER";
  }

  return false;
}

/**
 * Check if a user can access a note
 * Notes can be associated with a project or client
 * Access is granted if user can access the associated project
 * SUPER_ADMIN can access all notes
 * Requirements 7.1, 7.4
 */
export async function canAccessNote(
  user: PermissionUser,
  noteId: string
): Promise<boolean> {
  // SUPER_ADMIN can access all notes
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // Get the note to check its project association
  const notes = await _db
    .select({
      projectId: notesSqlite.projectId,
      clientId: notesSqlite.clientId,
      createdBy: notesSqlite.createdBy,
    })
    .from(notesSqlite)
    .where(eq(notesSqlite.id, noteId))
    .limit(1);

  const note = notes[0];
  if (!note) {
    return false;
  }

  // Creator can always access their own notes
  if (note.createdBy === user.id) {
    return true;
  }

  // If note is associated with a project, check project access
  if (note.projectId) {
    return canAccessProject(user, note.projectId);
  }

  // Client-level notes without project association
  // Only SUPER_ADMIN, ADMIN can access (already handled above)
  // MANAGER can access if they manage any project for that client
  if (user.role === "MANAGER") {
    // This would require checking if user manages any project for the client
    // For now, deny access to client-level notes for MANAGER without project association
    return false;
  }

  return false;
}

/**
 * Check if a user can view the secret (decrypted value) of a note
 * GUEST users cannot view secrets even if they can access the note
 * Requirements 2.6, 7.3, 7.4
 */
export async function canViewNoteSecret(
  user: PermissionUser,
  noteId: string
): Promise<boolean> {
  // GUEST users cannot view secrets
  if (user.role === "GUEST") {
    return false;
  }

  // Must have view_secrets permission
  if (!hasPermission(user.role, "view_secrets")) {
    // MEMBER role doesn't have view_secrets by default
    // But they can view secrets for notes in their assigned projects
    if (user.role === "MEMBER") {
      // Check if note is in a project they're a member of
      const notes = await _db
        .select({
          projectId: notesSqlite.projectId,
          createdBy: notesSqlite.createdBy,
        })
        .from(notesSqlite)
        .where(eq(notesSqlite.id, noteId))
        .limit(1);

      const note = notes[0];
      if (!note) {
        return false;
      }

      // Creator can view their own note secrets
      if (note.createdBy === user.id) {
        return true;
      }

      // Check project membership
      if (note.projectId) {
        return isProjectMember(user.id, note.projectId);
      }

      return false;
    }
    return false;
  }

  // User has view_secrets permission, now check if they can access the note
  return canAccessNote(user, noteId);
}

/**
 * Get the project member role for a user in a specific project
 * Returns null if user is not a member
 */
export async function getProjectMemberRole(
  userId: string,
  projectId: string
): Promise<"MANAGER" | "MEMBER" | "VIEWER" | null> {
  const members = await _db
    .select({ role: projectMembersSqlite.role })
    .from(projectMembersSqlite)
    .where(
      and(
        eq(projectMembersSqlite.userId, userId),
        eq(projectMembersSqlite.projectId, projectId)
      )
    )
    .limit(1);

  const member = members[0];
  if (!member) {
    return null;
  }

  return member.role;
}

/**
 * Check if a user can create tasks in a project
 * Requirements 2.4, 2.5, 5.1
 */
export async function canCreateTask(
  user: PermissionUser,
  projectId: string
): Promise<boolean> {
  // GUEST cannot create tasks
  if (user.role === "GUEST") {
    return false;
  }

  // Must be able to access the project
  const hasAccess = await canAccessProject(user, projectId);
  if (!hasAccess) {
    return false;
  }

  // SUPER_ADMIN, MANAGER can always create tasks if they have access
  if (user.role === "SUPER_ADMIN" || user.role === "MANAGER") {
    return true;
  }

  // MEMBER can create tasks in projects they're a member of
  if (user.role === "MEMBER") {
    const memberRole = await getProjectMemberRole(user.id, projectId);
    // VIEWER role in project cannot create tasks
    return memberRole !== null && memberRole !== "VIEWER";
  }

  return false;
}

/**
 * Check if a user can edit a task
 * Requirements 2.4, 2.5, 5.3
 */
export async function canEditTask(
  user: PermissionUser,
  projectId: string
): Promise<boolean> {
  // Same rules as creating tasks
  return canCreateTask(user, projectId);
}
