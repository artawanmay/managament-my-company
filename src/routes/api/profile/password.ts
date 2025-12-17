/**
 * Profile Password API Route
 * PUT /api/profile/password - Change current user password
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usersSqlite } from '@/lib/db/schema/users';
import { requireAuthWithCsrf, handleAuthError } from '@/lib/auth/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { z } from 'zod';

// Zod schema for changing password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const Route = createFileRoute('/api/profile/password')({
  server: {
    handlers: {
      /**
       * PUT /api/profile/password
       * Change current user password
       */
      PUT: async ({ request }) => {
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const body = await request.json();
          const parsed = changePasswordSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Get current user's password hash
          const userResult = await db
            .select({ passwordHash: usersSqlite.passwordHash })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, auth.user.id))
            .limit(1);

          const user = userResult[0];
          if (!user) {
            return json({ error: 'User not found' }, { status: 404 });
          }

          // Verify current password
          const isValidPassword = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
          if (!isValidPassword) {
            return json({ error: 'Current password is incorrect' }, { status: 400 });
          }

          // Hash new password
          const newPasswordHash = await hashPassword(parsed.data.newPassword);

          // Update password
          await db
            .update(usersSqlite)
            .set({
              passwordHash: newPasswordHash,
              updatedAt: new Date(),
            })
            .where(eq(usersSqlite.id, auth.user.id));

          return json({ success: true, message: 'Password changed successfully' });
        } catch (error) {
          console.error('[PUT /api/profile/password] Error:', error);
          return json({ error: 'Failed to change password' }, { status: 500 });
        }
      },
    },
  },
});
