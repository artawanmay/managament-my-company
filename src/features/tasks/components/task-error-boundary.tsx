/**
 * Task Error Boundary Component
 *
 * Catches render errors in task components and displays a fallback UI
 * with retry functionality. Logs errors with component stack trace.
 *
 * Requirements: 7.1 - WHEN a component throws error during render THEN the system
 *               SHALL catch the error with Error Boundary and display fallback UI
 * Requirements: 7.4 - WHEN state update causes error THEN the system SHALL rollback
 *               to previous stable state
 */
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logError } from "@/lib/logger";

interface TaskErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component to render instead of default */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback when retry is clicked */
  onRetry?: () => void;
}

interface TaskErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for task components that catches render errors
 * and provides a user-friendly fallback UI with retry capability.
 */
export class TaskErrorBoundary extends Component<
  TaskErrorBoundaryProps,
  TaskErrorBoundaryState
> {
  constructor(props: TaskErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<TaskErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error with component stack trace
    logError("[TaskErrorBoundary] Caught render error", {
      errorMessage: error.message,
      errorName: error.name,
      componentStack: errorInfo.componentStack,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Store error info for display
    this.setState({ errorInfo });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    // Reset error state to attempt re-render
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional retry callback
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <TaskErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface TaskErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}

/**
 * Fallback UI component displayed when an error is caught
 */
export function TaskErrorFallback({
  error,
  onRetry,
}: TaskErrorFallbackProps): ReactNode {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-lg">Something went wrong</CardTitle>
          <CardDescription>
            An error occurred while loading this component. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && process.env.NODE_ENV !== "production" && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium text-destructive">{error.name}</p>
              <p className="mt-1 text-muted-foreground break-words">
                {error.message}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Button onClick={onRetry} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default TaskErrorBoundary;
