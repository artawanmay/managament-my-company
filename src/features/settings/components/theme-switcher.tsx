/**
 * Theme Switcher Component
 *
 * Requirements:
 * - 16.1: Light theme with white and blue styling
 * - 16.2: Dark theme with black and blue styling
 * - 16.3: Theme preference persisted and applied immediately
 */
import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/layout/theme-provider';
import { useToast } from '@/hooks/use-toast';
import { useUpdateTheme } from '../hooks';
import type { ThemePreference } from '../types';

const themes: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

export function ThemeSwitcher() {
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const updateTheme = useUpdateTheme();

  const handleThemeChange = async (newTheme: ThemePreference) => {
    // Apply theme immediately via local state
    setTheme(newTheme);

    // Persist to server
    try {
      await updateTheme.mutateAsync(newTheme);
    } catch (error) {
      // Revert on error
      setTheme(theme as ThemePreference);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save theme preference',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the application looks. Currently using{' '}
          <span className="font-medium">{resolvedTheme}</span> mode.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {themes.map((t) => (
            <Button
              key={t.value}
              variant={theme === t.value ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleThemeChange(t.value)}
              disabled={updateTheme.isPending}
            >
              {t.icon}
              <span className="ml-2">{t.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
