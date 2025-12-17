/**
 * Standardized API response utilities
 * Ensures consistent response shape across all APIs
 *
 * @module lib/api/response
 */
import { json } from "@tanstack/react-start";

/**
 * Standard success response shape
 */
export interface SuccessResponse<T> {
  data: T;
}

/**
 * Standard error response shape
 */
export interface ErrorResponse {
  error: string;
  details?: Record<string, unknown>;
}

/**
 * Creates a success response body with consistent shape
 *
 * @param data - The data to include in the response
 * @returns Object with { data: T } shape
 */
export function createSuccessBody<T>(data: T): SuccessResponse<T> {
  return { data };
}

/**
 * Creates an error response body with consistent shape
 *
 * @param message - Error message string
 * @param details - Optional additional error details
 * @returns Object with { error: string, details?: object } shape
 */
export function createErrorBody(
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  const response: ErrorResponse = { error: message };
  if (details) {
    response.details = details;
  }
  return response;
}

/**
 * Creates a standardized success response
 *
 * @param data - The data to return in the response
 * @param status - HTTP status code (default: 200)
 * @returns JSON response with consistent shape { data: T }
 *
 * @example
 * return successResponse({ id: 1, name: 'Task' });
 * // Returns: { data: { id: 1, name: 'Task' } }
 *
 * @example
 * return successResponse(newItem, 201);
 * // Returns: { data: newItem } with status 201
 */
export function successResponse<T>(data: T, status: number = 200) {
  return json(createSuccessBody(data), { status });
}

/**
 * Creates a standardized error response
 *
 * @param message - Error message string
 * @param status - HTTP status code (default: 500)
 * @param details - Optional additional error details
 * @returns JSON response with consistent shape { error: string, details?: object }
 *
 * @example
 * return errorResponse('Not found', 404);
 * // Returns: { error: 'Not found' } with status 404
 *
 * @example
 * return errorResponse('Validation failed', 400, { field: 'email', reason: 'invalid format' });
 * // Returns: { error: 'Validation failed', details: { field: 'email', reason: 'invalid format' } }
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: Record<string, unknown>
) {
  return json(createErrorBody(message, details), { status });
}
