/**
 * Validation middleware for API routes
 * Requirements: 18.6 - THE System SHALL validate all API inputs using Zod schemas
 */
import { json } from '@tanstack/react-start';
import { z } from 'zod';

/**
 * Structured validation error response
 */
export interface ValidationErrorResponse {
  error: 'VALIDATION_ERROR';
  message: string;
  details: {
    field: string;
    message: string;
  }[];
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  error: z.ZodError<unknown>
): ValidationErrorResponse {
  return {
    error: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Validate request body with a Zod schema
 * Returns the validated data or throws a validation error response
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  let body: unknown;
  
  try {
    body = await request.json();
  } catch {
    throw json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Invalid JSON body',
        details: [{ field: 'body', message: 'Request body must be valid JSON' }],
      } as ValidationErrorResponse,
      { status: 400 }
    );
  }
  
  const result = schema.safeParse(body);
  
  if (!result.success) {
    throw json(createValidationErrorResponse(result.error), { status: 400 });
  }
  
  return result.data;
}

/**
 * Validate URL query parameters with a Zod schema
 * Returns the validated data or throws a validation error response
 */
export function validateQuery<T>(
  request: Request,
  schema: z.ZodSchema<T>
): T {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  const result = schema.safeParse(params);
  
  if (!result.success) {
    throw json(createValidationErrorResponse(result.error), { status: 400 });
  }
  
  return result.data;
}

/**
 * Validate URL path parameters with a Zod schema
 * Returns the validated data or throws a validation error response
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: z.ZodSchema<T>
): T {
  const result = schema.safeParse(params);
  
  if (!result.success) {
    throw json(createValidationErrorResponse(result.error), { status: 400 });
  }
  
  return result.data;
}

/**
 * Combined validation helper for common API patterns
 */
export interface ValidatedRequest<TBody, TQuery, TParams> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

/**
 * Validate all parts of a request at once
 */
export async function validateRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(
  request: Request,
  params: Record<string, string>,
  schemas: {
    body?: z.ZodSchema<TBody>;
    query?: z.ZodSchema<TQuery>;
    params?: z.ZodSchema<TParams>;
  }
): Promise<ValidatedRequest<TBody, TQuery, TParams>> {
  const result: ValidatedRequest<TBody, TQuery, TParams> = {
    body: undefined as TBody,
    query: undefined as TQuery,
    params: undefined as TParams,
  };
  
  if (schemas.params) {
    result.params = validateParams(params, schemas.params);
  }
  
  if (schemas.query) {
    result.query = validateQuery(request, schemas.query);
  }
  
  if (schemas.body) {
    result.body = await validateBody(request, schemas.body);
  }
  
  return result;
}

/**
 * Type-safe wrapper for creating validated API handlers
 */
export function withValidation<TBody, TQuery, TParams>(
  schemas: {
    body?: z.ZodSchema<TBody>;
    query?: z.ZodSchema<TQuery>;
    params?: z.ZodSchema<TParams>;
  },
  handler: (
    validated: ValidatedRequest<TBody, TQuery, TParams>,
    request: Request,
    params: Record<string, string>
  ) => Promise<Response>
) {
  return async (request: Request, params: Record<string, string>) => {
    const validated = await validateRequest(request, params, schemas);
    return handler(validated, request, params);
  };
}

/**
 * Check if a response is a validation error
 */
export function isValidationError(
  response: unknown
): response is ValidationErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    (response as ValidationErrorResponse).error === 'VALIDATION_ERROR'
  );
}
