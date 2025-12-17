/**
 * Profile Page
 * User can view and edit their profile, change password, upload avatar
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  ProfileInfo,
  AvatarUpload,
  ChangePasswordForm,
} from "@/features/profile/components";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account information and security
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <AvatarUpload />
          <ProfileInfo />
        </div>
        <div>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
