/**
 * Task validation schemas
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2
 */
import { z } from "zod";
import { taskStatusValues } from "@/lib/db/schema/tasks";
import { priorityValues } from "@/lib/db/schema/projects";
import {
  uuidSchema,
  requiredStringSchema,
  textSchema,
  optionalDateStringSchema,
  positiveNumberSchema,
  positiveIntSchema,
  baseListQuerySchema,
  sortOrderSchema,
} from "./common";

// Task status enum
export const taskStatusSchema = z.enum(taskStatusValues);

// Task priority enum (reuse from projects)
export const taskPrioritySchema = z.enum(priorityValues);

// Create task schema
export const createTaskSchema = z.object({
  projectId: uuidSchema,
  title: requiredStringSchema(255),
  description: textSchema(5000),
  status: taskStatusSchema.default("BACKLOG"),
  priority: taskPrioritySchema.default("MEDIUM"),
  assigneeId: uuidSchema.optional().nullable(),
  dueDate: optionalDateStringSchema,
  estimatedHours: positiveNumberSchema.optional().nullable(),
  linkedNoteId: uuidSchema.optional().nullable(),
});

// Update task schema (all fields optional)
export const updateTaskSchema = z.object({
  title: requiredStringSchema(255).optional(),
  description: textSchema(5000),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: uuidSchema.optional().nullable(),
  dueDate: optionalDateStringSchema,
  estimatedHours: positiveNumberSchema.optional().nullable(),
  actualHours: positiveNumberSchema.optional().nullable(),
  linkedNoteId: uuidSchema.optional().nullable(),
});

// Move task schema (for Kanban drag-drop)
export const moveTaskSchema = z.object({
  status: taskStatusSchema,
  order: positiveIntSchema,
});

// Task list query schema
export const taskListQuerySchema = baseListQuerySchema.extend({
  projectId: uuidSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: uuidSchema.optional(),
  includeOverdue: z.enum(["true", "false"]).default("false"),
  sortBy: z
    .enum([
      "title",
      "status",
      "priority",
      "dueDate",
      "createdAt",
      "updatedAt",
      "order",
    ])
    .default("createdAt"),
  sortOrder: sortOrderSchema,
});

// Task ID param schema
export const taskIdParamSchema = z.object({
  taskId: uuidSchema,
});

// Export types
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
