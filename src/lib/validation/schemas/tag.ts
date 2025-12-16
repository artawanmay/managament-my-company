/**
 * Tag validation schemas
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
import { z } from 'zod';
import { taggableTypeValues } from '@/lib/db/schema/taggables';
import {
  uuidSchema,
  requiredStringSchema,
  hexColorSchema,
  baseListQuerySchema,
  sortOrderSchema,
} from './common';

// Taggable type enum
export const taggableTypeSchema = z.enum(taggableTypeValues);

// Create tag schema
export const createTagSchema = z.object({
  name: requiredStringSchema(50),
  color: hexColorSchema,
});

// Update tag schema (all fields optional)
export const updateTagSchema = z.object({
  name: requiredStringSchema(50).optional(),
  color: hexColorSchema.optional(),
});

// Tag list query schema
export const tagListQuerySchema = baseListQuerySchema.extend({
  sortBy: z.enum(['name', 'createdAt']).default('name'),
  sortOrder: sortOrderSchema,
});

// Tag ID param schema
export const tagIdParamSchema = z.object({
  tagId: uuidSchema,
});

// Attach tag schema
export const attachTagSchema = z.object({
  taggableType: taggableTypeSchema,
  taggableId: uuidSchema,
});

// Detach tag schema
export const detachTagSchema = z.object({
  taggableType: taggableTypeSchema,
  taggableId: uuidSchema,
});

// Export types
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type TagListQuery = z.infer<typeof tagListQuerySchema>;
export type AttachTagInput = z.infer<typeof attachTagSchema>;
export type DetachTagInput = z.infer<typeof detachTagSchema>;
