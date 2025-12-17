/**
 * User Role API Route
 * PUT /api/users/:userId/role - Change user role
 *
 * Requirements:
 * - 2.2: SUPER_ADMIN has full control over all users
 * - 2.3: ADMIN can manage users excluding SUPER_ADMIN accounts
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usersSqlite, roleValues, type Role } from '@/lib/db/schema/users';
import { requireAuthWithCsrf, handleAuthError } from '@/lib/auth/middleware';
import { canManageUsers, canManageUser } from '@/lib/auth/permissions';
import { z } from 'zod';

// Zod schema for updating user role
const updateRoleSchema = z.object({
  role: z.enum(roleValues),
});

export const Route = createFileRoute('/api/users/$userId/role')({
  server: {
    handlers: {
      /**
       * PUT /api/users/:userId/role
       * Change user role with role hierarchy checks
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // Require at least ADMIN role to change user roles
        if (!canManageUsers(auth.user)) {
          return json({ error: 'Insufficient permissions to change user roles' }, { status: 403 });
        }

        try {
          const { userId } = params;

          // Prevent changing own role
          if (userId === auth.user.id) {
            return json({ error: 'You cannot change your own role' }, { status: 400 });
          }

          // Check if user exists and get their current role
          const existingUser = await db
            .select({ id: usersSqlite.id, role: usersSqlite.role, name: usersSqlite.name })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, userId))
            .limit(1);

          if (existingUser.length === 0) {
            return json({ error: 'User not found' }, { status: 404 });
          }

          const targetUser = existingUser[0]!;
          const targetCurrentRole = targetUser.role as Role;

          // Check role hierarchy - ADMIN cannot modify SUPER_ADMIN
          if (!canManageUser(auth.user, targetCurrentRole)) {
            return json(
              { error: 'You cannot modify users with equal or higher role' },
              { status: 403 }
            );
          }

          const body = await request.json();
          const parsed = updateRoleSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const newRole = parsed.data.role;

          // Check if the acting user can assign the new role
          // ADMIN cannot assign SUPER_ADMIN role
          if (auth.user.role !== 'SUPER_ADMIN' && newRole === 'SUPER_ADMIN') {
            return json(
              { error: 'Only SUPER_ADMIN can assign SUPER_ADMIN role' },
              { status: 403 }
            );
          }

          // Only SUPER_ADMIN can assign MANAGER role
          if (auth.user.role !== 'SUPER_ADMIN' && newRole === 'MANAGER') {
            return json(
              { error: 'Only SUPER_ADMIN can assign MANAGER role' },
              { status: 403 }
            );
          }

          // Update the user's role
          const result = await db
            .update(usersSqlite)
            .set({
              role: newRole,
              updatedAt: new Date(),
            })
            .where(eq(usersSqlite.id, userId))
            .returning({
              id: usersSqlite.id,
              email: usersSqlite.email,
              name: usersSqlite.name,
              role: usersSqlite.role,
              avatarUrl: usersSqlite.avatarUrl,
              createdAt: usersSqlite.createdAt,
              updatedAt: usersSqlite.updatedAt,
            });

          const updatedUser = result[0];

          if (!updatedUser) {
            return json({ error: 'Failed to update user role' }, { status: 500 });
          }

          return json({
            data: {
              ...updatedUser,
              createdAt: updatedUser.createdAt.toISOString(),
              updatedAt: updatedUser.updatedAt.toISOString(),
            },
            message: `User role changed from ${targetCurrentRole} to ${newRole}`,
          });
        } catch (error) {
          console.error('[PUT /api/users/:userId/role] Error:', error);
          return json({ error: 'Failed to change user role' }, { status: 500 });
        }
      },
    },
  },
});
