/**
 * React hook for error handling
 * Provides utilities for handling errors in React components
 */
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ApiError,
  handleApiError,
  showErrorToast,
  showSuccessToast,
} from "./client";

/**
 * Form errors state type
 */
export type FormErrors = Record<string, string>;

/**
 * Hook for handling API errors in components
 */
export function useErrorHandler() {
  const navigate = useNavigate();
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /**
   * Handle an API error with automatic navigation for auth errors
   */
  const handleError = useCallback(
    (error: unknown, options?: { context?: string; showToast?: boolean }) => {
      handleApiError(error, {
        showToast: options?.showToast ?? true,
        context: options?.context,
        onAuthError: () => {
          navigate({ to: "/auth/login" });
        },
        onValidationError: (errors) => {
          setFormErrors(errors);
        },
      });
    },
    [navigate]
  );

  /**
   * Clear form errors
   */
  const clearFormErrors = useCallback(() => {
    setFormErrors({});
  }, []);

  /**
   * Clear a specific field error
   */
  const clearFieldError = useCallback((field: string) => {
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * Get error for a specific field
   */
  const getFieldError = useCallback(
    (field: string): string | undefined => {
      return formErrors[field];
    },
    [formErrors]
  );

  /**
   * Check if a field has an error
   */
  const hasFieldError = useCallback(
    (field: string): boolean => {
      return !!formErrors[field];
    },
    [formErrors]
  );

  return {
    formErrors,
    handleError,
    clearFormErrors,
    clearFieldError,
    getFieldError,
    hasFieldError,
    showErrorToast,
    showSuccessToast,
  };
}

/**
 * Hook for mutation error/success handling
 */
export function useMutationHandlers(options?: {
  successMessage?: string;
  errorContext?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  const { handleError } = useErrorHandler();

  const onMutationError = useCallback(
    (error: Error) => {
      handleError(error, { context: options?.errorContext });
      options?.onError?.(error);
    },
    [handleError, options]
  );

  const onMutationSuccess = useCallback(() => {
    if (options?.successMessage) {
      showSuccessToast(options.successMessage);
    }
    options?.onSuccess?.();
  }, [options]);

  return {
    onError: onMutationError,
    onSuccess: onMutationSuccess,
  };
}

/**
 * Hook for handling form submission errors
 */
export function useFormErrorHandler() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  /**
   * Handle form submission error
   */
  const handleSubmitError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      if (error.isValidationError()) {
        setErrors(error.getFieldErrors());
        setGeneralError(null);
      } else {
        setGeneralError(error.message);
        setErrors({});
      }
    } else if (error instanceof Error) {
      setGeneralError(error.message);
      setErrors({});
    } else {
      setGeneralError("An unexpected error occurred");
      setErrors({});
    }
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
    setGeneralError(null);
  }, []);

  /**
   * Clear a specific field error
   */
  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * Set a field error manually
   */
  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  /**
   * Set general error manually
   */
  const setError = useCallback((message: string) => {
    setGeneralError(message);
  }, []);

  return {
    errors,
    generalError,
    handleSubmitError,
    clearErrors,
    clearFieldError,
    setFieldError,
    setError,
    hasErrors: Object.keys(errors).length > 0 || !!generalError,
  };
}
