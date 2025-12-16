import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projectsSqlite, priorityValues } from './projects';
import { usersSqlite } from './users';

// Task status values (Kanban columns)
export const taskStatusValues = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'DONE',
] as const;
export type TaskStatus = (typeof taskStatusValues)[number];

// Tasks Table
export const tasksSqlite = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projectsSqlite.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: taskStatusValues }).notNull().default('BACKLOG'),
    priority: text('priority', { enum: priorityValues }).notNull().default('MEDIUM'),
    assigneeId: text('assignee_id').references(() => usersSqlite.id, { onDelete: 'set null' }),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => usersSqlite.id, { onDelete: 'restrict' }),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    estimatedHours: real('estimated_hours'),
    actualHours: real('actual_hours'),
    linkedNoteId: text('linked_note_id'),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_assignee_id_idx').on(table.assigneeId),
    index('tasks_reporter_id_idx').on(table.reporterId),
    index('tasks_status_idx').on(table.status),
    index('tasks_due_date_idx').on(table.dueDate),
  ]
);

// Export types
export type Task = typeof tasksSqlite.$inferSelect;
export type NewTask = typeof tasksSqlite.$inferInsert;
