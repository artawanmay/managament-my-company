/**
 * Form Error Display Components
 * Requirements: 17.4, 17.5 - Display appropriate error states
 * Requirements: 29.8 - THE System SHALL display form validation errors with aria-describedby linking to error messages
 */
import * as React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for FormError component
 */
interface FormErrorProps {
  message?: string;
  className?: string;
  id?: string;
}

/**
 * Display a form field error message
 */
export function FormError({ message, className, id }: FormErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-sm text-destructive',
        className
      )}
    >
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Props for FormErrorSummary component
 */
interface FormErrorSummaryProps {
  errors: Record<string, string>;
  title?: string;
  className?: string;
}

/**
 * Display a summary of all form errors at the top of a form
 */
export function FormErrorSummary({
  errors,
  title = 'Please fix the following errors:',
  className,
}: FormErrorSummaryProps) {
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-md border border-destructive/50 bg-destructive/10 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 flex-shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-destructive">{title}</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-destructive/90">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                <span className="font-medium">{formatFieldName(field)}:</span>{' '}
                {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Props for GeneralError component
 */
interface GeneralErrorProps {
  message?: string | null;
  className?: string;
  onDismiss?: () => void;
}

/**
 * Display a general error message (not field-specific)
 */
export function GeneralError({
  message,
  className,
  onDismiss,
}: GeneralErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 p-4',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <AlertCircle
          className="h-5 w-5 flex-shrink-0 text-destructive"
          aria-hidden="true"
        />
        <p className="text-sm text-destructive">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-4 text-destructive/70 hover:text-destructive"
          aria-label="Dismiss error"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      )}
    </div>
  );
}

/**
 * Format a field name for display (e.g., "firstName" -> "First Name")
 */
function formatFieldName(field: string): string {
  // Handle nested fields (e.g., "address.city" -> "City")
  const lastPart = field.split('.').pop() || field;

  // Convert camelCase to Title Case
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Props for NetworkError component
 */
interface NetworkErrorProps {
  onRetry?: () => void;
  className?: string;
}

/**
 * Display a network error with retry option
 */
export function NetworkError({ onRetry, className }: NetworkErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center',
        className
      )}
    >
      <AlertTriangle
        className="h-10 w-10 text-destructive"
        aria-hidden="true"
      />
      <div>
        <h3 className="text-lg font-medium text-destructive">
          Connection Error
        </h3>
        <p className="mt-1 text-sm text-destructive/80">
          Unable to connect to the server. Please check your internet connection.
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Props for EmptyState component
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Display an empty state message
 * Requirements: 17.5 - WHEN no data exists THEN the System SHALL display appropriate empty state messages
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8 text-center',
        className
      )}
    >
      {icon && (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
