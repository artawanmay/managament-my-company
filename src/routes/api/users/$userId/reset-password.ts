/**
 * User Reset Password API Route (SUPER_ADMIN only)
 * POST /api/users/:userId/reset-password - Reset user password
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usersSqlite } from '@/lib/db/schema/users';
import { requireAuthWithCsrf, handleAuthError } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';
import { z } from 'zod';

// Zod schema for resetting password
const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const Route = createFileRoute('/api/users/$userId/reset-password')({
  server: {
    handlers: {
      /**
       * POST /api/users/:userId/reset-password
       * Reset user password (SUPER_ADMIN only)
       */
      POST: async ({ request, params }) => {
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Only SUPER_ADMIN can reset passwords
        if (auth.user.role !== 'SUPER_ADMIN') {
          return json({ error: 'Only SUPER_ADMIN can reset user passwords' }, { status: 403 });
        }

        try {
          const { userId } = params;

          // Prevent resetting own password through this endpoint
          if (userId === auth.user.id) {
            return json({ error: 'Use the profile password change to update your own password' }, { status: 400 });
          }

          // Check if user exists
          const userResult = await db
            .select({ id: usersSqlite.id, name: usersSqlite.name, role: usersSqlite.role })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, userId))
            .limit(1);

          const targetUser = userResult[0];
          if (!targetUser) {
            return json({ error: 'User not found' }, { status: 404 });
          }

          const body = await request.json();
          const parsed = resetPasswordSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
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
            .where(eq(usersSqlite.id, userId));

          return json({ 
            success: true, 
            message: `Password reset successfully for ${targetUser.name}` 
          });
        } catch (error) {
          console.error('[POST /api/users/:userId/reset-password] Error:', error);
          return json({ error: 'Failed to reset password' }, { status: 500 });
        }
      },
    },
  },
});
