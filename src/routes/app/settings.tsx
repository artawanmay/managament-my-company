/**
 * Settings Page
 *
 * Requirements:
 * - 16.3: Theme preference management
 * - 16.4: Profile update
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProfileForm, ThemeSwitcher } from "@/features/settings/components";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6">
        <ProfileForm />
        <ThemeSwitcher />
      </div>
    </div>
  );
}
