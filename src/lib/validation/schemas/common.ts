/**
 * Common validation schemas and utilities
 */
import { z } from "zod";

// UUID validation
export const uuidSchema = z.string().uuid("Invalid UUID format");

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Sort order schema
export const sortOrderSchema = z.enum(["asc", "desc"]).default("asc");

// Date string schema (ISO 8601)
export const dateStringSchema = z
  .string()
  .datetime({ message: "Invalid date format" });

// Optional date string
export const optionalDateStringSchema = dateStringSchema.optional().nullable();

// Email schema
export const emailSchema = z.string().email("Invalid email address").max(255);

// URL schema
export const urlSchema = z.string().url("Invalid URL format").max(2048);

// Phone schema (flexible format)
export const phoneSchema = z
  .string()
  .max(50)
  .regex(/^[\d\s\-+()]+$/, "Invalid phone number format");

// Hex color schema
export const hexColorSchema = z
  .string()
  .regex(
    /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    "Invalid hex color format (e.g., #FF5733 or #F53)"
  );

// Non-empty string with max length
export const requiredStringSchema = (maxLength: number = 255) =>
  z.string().min(1, "This field is required").max(maxLength);

// Optional string with max length
export const optionalStringSchema = (maxLength: number = 255) =>
  z.string().max(maxLength).optional().nullable();

// Text field (longer content)
export const textSchema = (maxLength: number = 5000) =>
  z.string().max(maxLength).optional().nullable();

// Positive number
export const positiveNumberSchema = z.number().min(0);

// Positive integer
export const positiveIntSchema = z.coerce.number().int().min(0);

// Search query schema
export const searchQuerySchema = z.object({
  search: z.string().max(255).optional(),
});

// Base list query schema
export const baseListQuerySchema = paginationSchema.merge(searchQuerySchema);

// Validation error response type
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Parse and validate data with a Zod schema
 * Returns a structured result with field-level errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Format Zod errors into a flat object for form display
 */
export function formatZodErrors(
  error: z.ZodError<unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}
