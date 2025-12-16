/**
 * Error Response Utilities
 * Standardized error response format for API routes
 * Requirements: 18.6 - THE System SHALL validate all API inputs using Zod schemas
 * Requirements: 22.6 - WHEN API validation fails THEN the System SHALL return structured error response with field-level details
 * Requirements: 22.7 - WHEN an unexpected error occurs THEN the System SHALL log the error securely without exposing sensitive data to client
 */
import { json } from '@tanstack/react-start';
import { z } from 'zod';

/**
 * Standard error codes used throughout the application
 */
export const ErrorCode = {
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  CSRF_INVALID: 'CSRF_INVALID',
  
  // Client errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  REFERENTIAL_INTEGRITY: 'REFERENTIAL_INTEGRITY',
  
  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  
  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Field-level validation error detail
 */
export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  error: ErrorCodeType;
  message: string;
  details?: FieldError[];
  requestId?: string;
  retryAfter?: number; // For rate limiting
}

/**
 * User-friendly error messages for each error code
 */
const errorMessages: Record<ErrorCodeType, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
  [ErrorCode.CSRF_INVALID]: 'Invalid security token. Please refresh the page and try again.',
  [ErrorCode.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCode.BAD_REQUEST]: 'Invalid request',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCode.CONFLICT]: 'Operation conflicts with existing data',
  [ErrorCode.DUPLICATE_ENTRY]: 'A record with this information already exists',
  [ErrorCode.REFERENTIAL_INTEGRITY]: 'Cannot delete this record because it is referenced by other records',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please try again later.',
  [ErrorCode.ACCOUNT_LOCKED]: 'Account temporarily locked due to too many failed attempts',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.',
  [ErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
};

/**
 * HTTP status codes for each error code
 */
const errorStatusCodes: Record<ErrorCodeType, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.CSRF_INVALID]: 403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.REFERENTIAL_INTEGRITY]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.ACCOUNT_LOCKED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCodeType,
  options?: {
    message?: string;
    details?: FieldError[];
    retryAfter?: number;
    includeRequestId?: boolean;
  }
): ErrorResponse {
  const response: ErrorResponse = {
    error: code,
    message: options?.message || errorMessages[code],
  };

  if (options?.details && options.details.length > 0) {
    response.details = options.details;
  }

  if (options?.retryAfter !== undefined) {
    response.retryAfter = options.retryAfter;
  }

  if (options?.includeRequestId) {
    response.requestId = generateRequestId();
  }

  return response;
}

/**
 * Create a JSON response with the appropriate status code
 */
export function errorResponse(
  code: ErrorCodeType,
  options?: {
    message?: string;
    details?: FieldError[];
    retryAfter?: number;
    includeRequestId?: boolean;
  }
): Response {
  const status = errorStatusCodes[code];
  const body = createErrorResponse(code, options);
  
  const headers: HeadersInit = {};
  if (body.retryAfter !== undefined) {
    headers['Retry-After'] = body.retryAfter.toString();
  }

  return json(body, { status, headers });
}

/**
 * Create a validation error response from Zod errors
 */
export function validationErrorResponse(zodError: z.ZodError): Response {
  const details: FieldError[] = zodError.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return errorResponse(ErrorCode.VALIDATION_ERROR, { details });
}

/**
 * Create a not found error response
 */
export function notFoundResponse(resourceType?: string): Response {
  const message = resourceType
    ? `${resourceType} not found`
    : errorMessages[ErrorCode.NOT_FOUND];
  
  return errorResponse(ErrorCode.NOT_FOUND, { message });
}

/**
 * Create an unauthorized error response
 */
export function unauthorizedResponse(message?: string): Response {
  return errorResponse(ErrorCode.UNAUTHORIZED, { message });
}

/**
 * Create a forbidden error response
 */
export function forbiddenResponse(message?: string): Response {
  return errorResponse(ErrorCode.FORBIDDEN, { message });
}

/**
 * Create a rate limited error response
 */
export function rateLimitedResponse(retryAfter: number): Response {
  return errorResponse(ErrorCode.RATE_LIMITED, { retryAfter });
}

/**
 * Create an account locked error response
 */
export function accountLockedResponse(retryAfter: number): Response {
  return errorResponse(ErrorCode.ACCOUNT_LOCKED, { retryAfter });
}

/**
 * Create an internal server error response
 * Logs the actual error securely without exposing details to client
 */
export function internalErrorResponse(
  error: unknown,
  context?: string
): Response {
  // Log the actual error securely (server-side only)
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(`[${context || 'API'}] Internal error:`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });

  // Return generic error to client (never expose internal details)
  return errorResponse(ErrorCode.INTERNAL_ERROR, { includeRequestId: true });
}

/**
 * Create a conflict error response (e.g., duplicate entry)
 */
export function conflictResponse(message?: string): Response {
  return errorResponse(ErrorCode.CONFLICT, { message });
}

/**
 * Create a referential integrity error response
 */
export function referentialIntegrityResponse(message?: string): Response {
  return errorResponse(ErrorCode.REFERENTIAL_INTEGRITY, { message });
}

/**
 * Check if an error response matches a specific error code
 */
export function isErrorCode(
  response: unknown,
  code: ErrorCodeType
): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    (response as ErrorResponse).error === code
  );
}

/**
 * Check if a response is any error response
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ErrorResponse).error === 'string' &&
    'message' in response &&
    typeof (response as ErrorResponse).message === 'string'
  );
}

/**
 * Parse database errors and return appropriate error response
 */
export function handleDatabaseError(error: unknown, context?: string): Response {
  const errorMessage = error instanceof Error ? error.message : '';
  
  // Check for common database constraint violations
  if (errorMessage.includes('UNIQUE constraint failed') || 
      errorMessage.includes('duplicate key')) {
    return errorResponse(ErrorCode.DUPLICATE_ENTRY);
  }
  
  if (errorMessage.includes('FOREIGN KEY constraint failed') ||
      errorMessage.includes('violates foreign key constraint')) {
    return errorResponse(ErrorCode.REFERENTIAL_INTEGRITY);
  }

  // Log and return generic database error
  return internalErrorResponse(error, context || 'Database');
}
