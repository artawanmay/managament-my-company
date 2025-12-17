import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projectsSqlite } from "./projects";
import { usersSqlite } from "./users";

// Project member role values
export const projectMemberRoleValues = ["MANAGER", "MEMBER", "VIEWER"] as const;
export type ProjectMemberRole = (typeof projectMemberRoleValues)[number];

// Project Members Table
export const projectMembersSqlite = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsSqlite.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersSqlite.id, { onDelete: "cascade" }),
    role: text("role", { enum: projectMemberRoleValues })
      .notNull()
      .default("MEMBER"),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("project_members_project_id_idx").on(table.projectId),
    index("project_members_user_id_idx").on(table.userId),
    unique("project_members_unique").on(table.projectId, table.userId),
  ]
);

// Export types
export type ProjectMember = typeof projectMembersSqlite.$inferSelect;
export type NewProjectMember = typeof projectMembersSqlite.$inferInsert;
