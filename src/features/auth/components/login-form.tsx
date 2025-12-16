/**
 * LoginForm Component
 *
 * Requirements:
 * - 1.1: Email and password fields with validation
 * - 1.2: Error display for invalid credentials
 * - 1.3: Error display for lockout
 */
import * as React from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';

// Zod schema for login form validation
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  lockoutMinutes?: number | null;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginForm({
  onSubmit,
  isLoading = false,
  error = null,
  lockoutMinutes = null,
}: LoginFormProps) {
  const [formData, setFormData] = React.useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = React.useState<FormErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const validateField = (name: keyof LoginFormData, value: string): string | undefined => {
    const fieldSchema = loginSchema.shape[name];
    const result = fieldSchema.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validate on change if field has been touched
    if (touched[name]) {
      const error = validateField(name as keyof LoginFormData, value);
      setFormErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name as keyof LoginFormData, value);
    setFormErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate all fields
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const errors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormErrors;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFormErrors(errors);
      setTouched({ email: true, password: true });
      return;
    }

    // Clear form errors and submit
    setFormErrors({});
    await onSubmit(result.data);
  };

  const isLocked = lockoutMinutes !== null && lockoutMinutes > 0;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-xl font-bold">M</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Welcome to MMC</CardTitle>
        <CardDescription className="text-center">
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {(error || isLocked) && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                {isLocked ? (
                  <span>
                    Account is temporarily locked. Please try again in{' '}
                    <strong>{lockoutMinutes} minute{lockoutMinutes !== 1 ? 's' : ''}</strong>.
                  </span>
                ) : (
                  <span>{error}</span>
                )}
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading || isLocked}
                className={`pl-10 ${formErrors.email ? 'border-destructive' : ''}`}
                autoComplete="email"
                autoFocus
              />
            </div>
            {formErrors.email && touched.email && (
              <p className="text-sm text-destructive">{formErrors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading || isLocked}
                className={`pl-10 ${formErrors.password ? 'border-destructive' : ''}`}
                autoComplete="current-password"
              />
            </div>
            {formErrors.password && touched.password && (
              <p className="text-sm text-destructive">{formErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || isLocked}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
