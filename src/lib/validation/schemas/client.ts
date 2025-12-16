/**
 * Client validation schemas
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import { z } from 'zod';
import { clientStatusValues } from '@/lib/db/schema/clients';
import {
  uuidSchema,
  emailSchema,
  phoneSchema,
  urlSchema,
  requiredStringSchema,
  optionalStringSchema,
  textSchema,
  baseListQuerySchema,
  sortOrderSchema,
} from './common';

// Client status enum
export const clientStatusSchema = z.enum(clientStatusValues);

// Create client schema
export const createClientSchema = z.object({
  name: requiredStringSchema(255),
  picName: optionalStringSchema(255),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  address: textSchema(1000),
  website: urlSchema.optional().nullable(),
  status: clientStatusSchema.default('PROSPECT'),
  notes: textSchema(5000),
});

// Update client schema (all fields optional)
export const updateClientSchema = z.object({
  name: requiredStringSchema(255).optional(),
  picName: optionalStringSchema(255),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  address: textSchema(1000),
  website: urlSchema.optional().nullable(),
  status: clientStatusSchema.optional(),
  notes: textSchema(5000),
});

// Client list query schema
export const clientListQuerySchema = baseListQuerySchema.extend({
  status: clientStatusSchema.optional(),
  sortBy: z.enum(['name', 'status', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: sortOrderSchema,
});

// Client ID param schema
export const clientIdParamSchema = z.object({
  clientId: uuidSchema,
});

// Export types
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
