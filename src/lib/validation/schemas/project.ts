/**
 * Project validation schemas
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import { z } from 'zod';
import { projectStatusValues, priorityValues } from '@/lib/db/schema/projects';
import { projectMemberRoleValues } from '@/lib/db/schema/project-members';
import {
  uuidSchema,
  requiredStringSchema,
  textSchema,
  optionalDateStringSchema,
  baseListQuerySchema,
  sortOrderSchema,
} from './common';

// Project status enum
export const projectStatusSchema = z.enum(projectStatusValues);

// Priority enum
export const prioritySchema = z.enum(priorityValues);

// Project member role enum
export const projectMemberRoleSchema = z.enum(projectMemberRoleValues);

// Create project schema
export const createProjectSchema = z.object({
  clientId: uuidSchema,
  name: requiredStringSchema(255),
  description: textSchema(5000),
  status: projectStatusSchema.default('PLANNING'),
  priority: prioritySchema.default('MEDIUM'),
  startDate: optionalDateStringSchema,
  endDate: optionalDateStringSchema,
  managerId: uuidSchema,
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

// Update project schema (all fields optional)
export const updateProjectSchema = z.object({
  clientId: uuidSchema.optional(),
  name: requiredStringSchema(255).optional(),
  description: textSchema(5000),
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
  startDate: optionalDateStringSchema,
  endDate: optionalDateStringSchema,
  managerId: uuidSchema.optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

// Project list query schema
export const projectListQuerySchema = baseListQuerySchema.extend({
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
  clientId: uuidSchema.optional(),
  includeArchived: z.enum(['true', 'false']).default('false'),
  sortBy: z.enum(['name', 'status', 'priority', 'startDate', 'endDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: sortOrderSchema,
});

// Project ID param schema
export const projectIdParamSchema = z.object({
  projectId: uuidSchema,
});

// Add member schema
export const addMemberSchema = z.object({
  userId: uuidSchema,
  role: projectMemberRoleSchema.default('MEMBER'),
});

// Remove member param schema
export const removeMemberParamSchema = z.object({
  projectId: uuidSchema,
  userId: uuidSchema,
});

// Export types
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
