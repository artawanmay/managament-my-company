/**
 * Comment validation schemas
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
import { z } from "zod";
import { uuidSchema, urlSchema } from "./common";

// Create comment schema
export const createCommentSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(5000, "Message is too long (max 5000 characters)"),
  attachments: z
    .array(urlSchema)
    .max(10, "Maximum 10 attachments allowed")
    .optional()
    .nullable(),
});

// Update comment schema
export const updateCommentSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(5000, "Message is too long (max 5000 characters)"),
});

// Comment ID param schema
export const commentIdParamSchema = z.object({
  commentId: uuidSchema,
});

// Task comments param schema
export const taskCommentsParamSchema = z.object({
  taskId: uuidSchema,
});

// Export types
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
