/**
 * User validation schemas
 * Requirements: 2.1, 2.2, 2.3, 16.3, 16.4
 */
import { z } from 'zod';
import { roleValues, themeValues } from '@/lib/db/schema/users';
import {
  uuidSchema,
  emailSchema,
  requiredStringSchema,
  urlSchema,
  baseListQuerySchema,
  sortOrderSchema,
} from './common';

// Role enum
export const roleSchema = z.enum(roleValues);

// Theme preference enum
export const themePreferenceSchema = z.enum(themeValues);

// Create user schema (admin only)
export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: requiredStringSchema(100),
  role: roleSchema.default('MEMBER'),
  avatarUrl: urlSchema.optional().nullable(),
});

// Update user schema
export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  name: requiredStringSchema(100).optional(),
  avatarUrl: urlSchema.optional().nullable(),
});

// Update user role schema
export const updateUserRoleSchema = z.object({
  role: roleSchema,
});

// Update profile schema (self-update)
export const updateProfileSchema = z.object({
  name: requiredStringSchema(100).optional(),
  email: emailSchema.optional(),
});

// Update theme schema
export const updateThemeSchema = z.object({
  theme: themePreferenceSchema,
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// User list query schema
export const userListQuerySchema = baseListQuerySchema.extend({
  role: roleSchema.optional(),
  sortBy: z.enum(['name', 'email', 'role', 'createdAt']).default('name'),
  sortOrder: sortOrderSchema,
});

// User ID param schema
export const userIdParamSchema = z.object({
  userId: uuidSchema,
});

// Export types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
