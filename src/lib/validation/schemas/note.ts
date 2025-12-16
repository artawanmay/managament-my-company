/**
 * Note validation schemas
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
import { z } from 'zod';
import { noteTypeValues } from '@/lib/db/schema/notes';
import {
  uuidSchema,
  requiredStringSchema,
  optionalStringSchema,
  baseListQuerySchema,
  sortOrderSchema,
} from './common';

// Note type enum
export const noteTypeSchema = z.enum(noteTypeValues);

// Metadata schema (flexible JSON object)
export const metadataSchema = z.record(z.string(), z.unknown()).optional().nullable();

// Port schema with validation
export const portSchema = z.coerce.number().int().min(0).max(65535, 'Port must be between 0 and 65535');

// Create note schema
export const createNoteSchema = z.object({
  type: noteTypeSchema.default('OTHER'),
  systemName: requiredStringSchema(255),
  clientId: uuidSchema.optional().nullable(),
  projectId: uuidSchema.optional().nullable(),
  host: optionalStringSchema(255),
  port: portSchema.optional().nullable(),
  username: optionalStringSchema(255),
  secret: z.string().min(1, 'Secret is required').max(10000, 'Secret is too long'),
  metadata: metadataSchema,
});

// Update note schema (all fields optional)
export const updateNoteSchema = z.object({
  type: noteTypeSchema.optional(),
  systemName: requiredStringSchema(255).optional(),
  clientId: uuidSchema.optional().nullable(),
  projectId: uuidSchema.optional().nullable(),
  host: optionalStringSchema(255),
  port: portSchema.optional().nullable(),
  username: optionalStringSchema(255),
  secret: z.string().min(1, 'Secret is required').max(10000, 'Secret is too long').optional(),
  metadata: metadataSchema,
});

// Note list query schema
export const noteListQuerySchema = baseListQuerySchema.extend({
  projectId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  type: noteTypeSchema.optional(),
  sortBy: z.enum(['systemName', 'type', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: sortOrderSchema,
});

// Note ID param schema
export const noteIdParamSchema = z.object({
  noteId: uuidSchema,
});

// Export types
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
