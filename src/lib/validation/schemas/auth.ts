/**
 * Authentication validation schemas
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
import { z } from "zod";
import { emailSchema } from "./common";

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

// Session validation schema
export const sessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

// CSRF token schema
export const csrfTokenSchema = z.object({
  csrfToken: z.string().min(1, "CSRF token is required"),
});

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type CsrfTokenInput = z.infer<typeof csrfTokenSchema>;
