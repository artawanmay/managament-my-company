/**
 * Database Schema Index
 *
 * This file exports all SQLite schema definitions for use with Drizzle ORM.
 * SQLite is used for development, PostgreSQL schemas can be added for production.
 */

// Core entities
export {
  usersSqlite as users,
  roleValues,
  themeValues,
  type Role,
  type ThemePreference,
  type User,
  type NewUser,
} from "./users";

export {
  sessionsSqlite as sessions,
  type Session,
  type NewSession,
} from "./sessions";

export {
  clientsSqlite as clients,
  clientStatusValues,
  type ClientStatus,
  type Client,
  type NewClient,
} from "./clients";

export {
  projectsSqlite as projects,
  projectStatusValues,
  priorityValues,
  type ProjectStatus,
  type Priority,
  type Project,
  type NewProject,
} from "./projects";

export {
  projectMembersSqlite as projectMembers,
  projectMemberRoleValues,
  type ProjectMemberRole,
  type ProjectMember,
  type NewProjectMember,
} from "./project-members";

export {
  tasksSqlite as tasks,
  taskStatusValues,
  type TaskStatus,
  type Task,
  type NewTask,
} from "./tasks";

export {
  notesSqlite as notes,
  noteTypeValues,
  type NoteType,
  type Note,
  type NewNote,
} from "./notes";

export {
  noteAccessLogsSqlite as noteAccessLogs,
  noteAccessActionValues,
  type NoteAccessAction,
  type NoteAccessLog,
  type NewNoteAccessLog,
} from "./note-access-logs";

export {
  commentsSqlite as comments,
  type Comment,
  type NewComment,
} from "./comments";

export {
  notificationsSqlite as notifications,
  notificationTypeValues,
  type NotificationType,
  type Notification,
  type NewNotification,
} from "./notifications";

export {
  activityLogsSqlite as activityLogs,
  entityTypeValues,
  actionValues,
  type EntityType,
  type Action,
  type ActivityLog,
  type NewActivityLog,
} from "./activity-logs";

export { filesSqlite as files, type File, type NewFile } from "./files";

export { tagsSqlite as tags, type Tag, type NewTag } from "./tags";

export {
  taggablesSqlite as taggables,
  taggableTypeValues,
  type TaggableType,
  type Taggable,
  type NewTaggable,
} from "./taggables";
