/**
 * Client-side Error Handling Utilities
 * Requirements: 17.4 - WHEN loading content THEN the System SHALL display skeleton loaders until data is ready
 * Requirements: 17.5 - WHEN no data exists THEN the System SHALL display appropriate empty state messages
 * Requirements: 26.11 - WHEN any operation fails THEN the System SHALL display toast notification with error message
 * Requirements: 26.12 - WHEN any operation succeeds THEN the System SHALL display toast notification with success message
 */
import { toast } from '@/hooks/use-toast';
import type { ErrorResponse, FieldError, ErrorCodeType } from './index';
import { ErrorCode } from './index';

/**
 * API Error class for typed error handling
 */
export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly details?: FieldError[];
  public readonly retryAfter?: number;
  public readonly requestId?: string;
  public readonly status: number;

  constructor(
    message: string,
    code: ErrorCodeType,
    status: number,
    options?: {
      details?: FieldError[];
      retryAfter?: number;
      requestId?: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = options?.details;
    this.retryAfter = options?.retryAfter;
    this.requestId = options?.requestId;
  }

  /**
   * Check if this is a specific error type
   */
  is(code: ErrorCodeType): boolean {
    return this.code === code;
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return (
      this.code === ErrorCode.UNAUTHORIZED ||
      this.code === ErrorCode.SESSION_EXPIRED ||
      this.code === ErrorCode.INVALID_CREDENTIALS
    );
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return this.code === ErrorCode.VALIDATION_ERROR;
  }

  /**
   * Check if this is a rate limit error
   */
  isRateLimitError(): boolean {
    return (
      this.code === ErrorCode.RATE_LIMITED ||
      this.code === ErrorCode.ACCOUNT_LOCKED
    );
  }

  /**
   * Get field-specific error message
   */
  getFieldError(fieldName: string): string | undefined {
    return this.details?.find((d) => d.field === fieldName)?.message;
  }

  /**
   * Get all field errors as a map
   */
  getFieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    this.details?.forEach((d) => {
      errors[d.field] = d.message;
    });
    return errors;
  }
}

/**
 * Parse an API response and throw ApiError if it's an error response
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    // Check if it's a structured error response
    if (isErrorResponse(data)) {
      throw new ApiError(data.message, data.error, response.status, {
        details: data.details,
        retryAfter: data.retryAfter,
        requestId: data.requestId,
      });
    }

    // Handle legacy error format
    throw new ApiError(
      data.error || data.message || 'An unexpected error occurred',
      ErrorCode.INTERNAL_ERROR,
      response.status
    );
  }

  return data;
}

/**
 * Check if a response is an error response
 */
function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    'message' in data
  );
}

/**
 * User-friendly error messages for display
 */
const userFriendlyMessages: Partial<Record<ErrorCodeType, string>> = {
  [ErrorCode.UNAUTHORIZED]: 'Please log in to continue',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCode.FORBIDDEN]: 'You don\'t have permission to do this',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You don\'t have permission to perform this action',
  [ErrorCode.CSRF_INVALID]: 'Security token expired. Please refresh the page.',
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again',
  [ErrorCode.NOT_FOUND]: 'The requested item was not found',
  [ErrorCode.DUPLICATE_ENTRY]: 'This item already exists',
  [ErrorCode.REFERENTIAL_INTEGRITY]: 'Cannot delete this item because it\'s being used elsewhere',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment.',
  [ErrorCode.ACCOUNT_LOCKED]: 'Account temporarily locked. Please try again later.',
  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong. Please try again.',
};

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return userFriendlyMessages[error.code] || error.message;
  }

  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network error. Please check your connection.';
    }
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Show an error toast notification
 */
export function showErrorToast(
  error: unknown,
  options?: {
    title?: string;
  }
): void {
  const message = getUserFriendlyMessage(error);
  const title = options?.title || 'Error';

  toast({
    variant: 'destructive',
    title,
    description: message,
  });
}

/**
 * Show a success toast notification
 */
export function showSuccessToast(
  message: string,
  options?: {
    title?: string;
  }
): void {
  toast({
    title: options?.title || 'Success',
    description: message,
  });
}

/**
 * Show an info toast notification
 */
export function showInfoToast(
  message: string,
  options?: {
    title?: string;
  }
): void {
  toast({
    title: options?.title || 'Info',
    description: message,
  });
}

/**
 * Handle API errors with automatic toast notifications
 * Returns true if the error was handled (e.g., redirected to login)
 */
export function handleApiError(
  error: unknown,
  options?: {
    showToast?: boolean;
    onAuthError?: () => void;
    onValidationError?: (errors: Record<string, string>) => void;
    context?: string;
  }
): boolean {
  const { showToast = true, onAuthError, onValidationError, context } = options || {};

  if (error instanceof ApiError) {
    // Handle authentication errors
    if (error.isAuthError()) {
      if (onAuthError) {
        onAuthError();
        return true;
      }
      // Default: redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
        return true;
      }
    }

    // Handle validation errors
    if (error.isValidationError() && onValidationError) {
      onValidationError(error.getFieldErrors());
      if (showToast) {
        showErrorToast(error, { title: context ? `${context} failed` : 'Validation Error' });
      }
      return true;
    }

    // Handle rate limiting
    if (error.isRateLimitError()) {
      const retryMessage = error.retryAfter
        ? `Please try again in ${Math.ceil(error.retryAfter / 60)} minutes.`
        : 'Please try again later.';
      
      if (showToast) {
        showErrorToast(new Error(retryMessage), { title: 'Too Many Requests' });
      }
      return true;
    }
  }

  // Show generic error toast
  if (showToast) {
    showErrorToast(error, { title: context ? `${context} failed` : undefined });
  }

  return false;
}

/**
 * Create a mutation error handler for TanStack Query
 */
export function createMutationErrorHandler(options?: {
  context?: string;
  onAuthError?: () => void;
  onValidationError?: (errors: Record<string, string>) => void;
}) {
  return (error: Error) => {
    handleApiError(error, {
      showToast: true,
      ...options,
    });
  };
}

/**
 * Create a mutation success handler for TanStack Query
 */
export function createMutationSuccessHandler(
  message: string,
  options?: {
    title?: string;
    onSuccess?: () => void;
  }
) {
  return () => {
    showSuccessToast(message, { title: options?.title });
    options?.onSuccess?.();
  };
}

/**
 * Retry configuration for network errors
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  // Don't retry on client errors (4xx)
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }

  // Retry up to 3 times for network/server errors
  return failureCount < 3;
}

/**
 * Calculate retry delay with exponential backoff
 */
export function getRetryDelay(attemptIndex: number): number {
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
}

/**
 * Form field error helper for displaying validation errors
 */
export interface FormFieldError {
  hasError: boolean;
  message?: string;
}

/**
 * Get form field error state from API error
 */
export function getFormFieldError(
  error: unknown,
  fieldName: string
): FormFieldError {
  if (error instanceof ApiError && error.isValidationError()) {
    const message = error.getFieldError(fieldName);
    return {
      hasError: !!message,
      message,
    };
  }
  return { hasError: false };
}

/**
 * Network status utilities
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof Error && error.message.includes('network')) {
    return true;
  }
  return false;
}
