/**
 * Single User API Routes
 * GET /api/users/:userId - Get single user
 * PUT /api/users/:userId - Update user
 * DELETE /api/users/:userId - Delete user
 *
 * Requirements:
 * - 2.2: SUPER_ADMIN has full control over all users
 * - 2.3: ADMIN can manage users excluding SUPER_ADMIN accounts
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usersSqlite, type Role } from "@/lib/db/schema/users";
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from "@/lib/auth/middleware";
import { canManageUsers, canManageUser } from "@/lib/auth/permissions";
import { z } from "zod";

// Zod schema for updating a user
const updateUserSchema = z.object({
  email: z.string().email("Invalid email").max(255).optional(),
  name: z.string().min(1, "Name is required").max(100).optional(),
  avatarUrl: z
    .string()
    .url("Invalid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const Route = createFileRoute("/api/users/$userId")({
  server: {
    handlers: {
      /**
       * GET /api/users/:userId
       * Get single user
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least ADMIN role to view users
        if (!canManageUsers(auth.user)) {
          return json(
            { error: "Insufficient permissions to view users" },
            { status: 403 }
          );
        }

        try {
          const { userId } = params;

          // Fetch user
          const userResult = await db
            .select({
              id: usersSqlite.id,
              email: usersSqlite.email,
              name: usersSqlite.name,
              role: usersSqlite.role,
              avatarUrl: usersSqlite.avatarUrl,
              themePreference: usersSqlite.themePreference,
              createdAt: usersSqlite.createdAt,
              updatedAt: usersSqlite.updatedAt,
            })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, userId))
            .limit(1);

          const user = userResult[0];

          if (!user) {
            return json({ error: "User not found" }, { status: 404 });
          }

          return json({
            data: {
              ...user,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          });
        } catch (error) {
          console.error("[GET /api/users/:userId] Error:", error);
          return json({ error: "Failed to fetch user" }, { status: 500 });
        }
      },

      /**
       * PUT /api/users/:userId
       * Update user (not role - use /role endpoint for that)
       */
      PUT: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least ADMIN role to update users
        if (!canManageUsers(auth.user)) {
          return json(
            { error: "Insufficient permissions to update users" },
            { status: 403 }
          );
        }

        try {
          const { userId } = params;

          // Check if user exists and get their role
          const existingUser = await db
            .select({
              id: usersSqlite.id,
              role: usersSqlite.role,
              email: usersSqlite.email,
            })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, userId))
            .limit(1);

          if (existingUser.length === 0) {
            return json({ error: "User not found" }, { status: 404 });
          }

          const targetUser = existingUser[0]!;

          // Check role hierarchy - ADMIN cannot modify SUPER_ADMIN
          if (!canManageUser(auth.user, targetUser.role as Role)) {
            return json(
              { error: "You cannot modify users with equal or higher role" },
              { status: 403 }
            );
          }

          const body = await request.json();
          const parsed = updateUserSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // If email is being changed, check for uniqueness
          if (parsed.data.email && parsed.data.email !== targetUser.email) {
            const emailExists = await db
              .select({ id: usersSqlite.id })
              .from(usersSqlite)
              .where(eq(usersSqlite.email, parsed.data.email))
              .limit(1);

            if (emailExists.length > 0) {
              return json(
                { error: "Email is already in use" },
                { status: 409 }
              );
            }
          }

          // Build update data, only including provided fields
          const updateData: Record<string, unknown> = {
            updatedAt: Math.floor(Date.now() / 1000),
          };

          if (parsed.data.email !== undefined)
            updateData.email = parsed.data.email;
          if (parsed.data.name !== undefined)
            updateData.name = parsed.data.name;
          if (parsed.data.avatarUrl !== undefined)
            updateData.avatarUrl = parsed.data.avatarUrl || null;

          const result = await db
            .update(usersSqlite)
            .set(updateData)
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
            return json({ error: "Failed to update user" }, { status: 500 });
          }

          return json({
            data: {
              ...updatedUser,
              createdAt: updatedUser.createdAt,
              updatedAt: updatedUser.updatedAt,
            },
          });
        } catch (error) {
          console.error("[PUT /api/users/:userId] Error:", error);
          return json({ error: "Failed to update user" }, { status: 500 });
        }
      },

      /**
       * DELETE /api/users/:userId
       * Delete user
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least ADMIN role to delete users
        if (!canManageUsers(auth.user)) {
          return json(
            { error: "Insufficient permissions to delete users" },
            { status: 403 }
          );
        }

        try {
          const { userId } = params;

          // Prevent self-deletion
          if (userId === auth.user.id) {
            return json(
              { error: "You cannot delete your own account" },
              { status: 400 }
            );
          }

          // Check if user exists and get their role
          const existingUser = await db
            .select({ id: usersSqlite.id, role: usersSqlite.role })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, userId))
            .limit(1);

          if (existingUser.length === 0) {
            return json({ error: "User not found" }, { status: 404 });
          }

          const targetUserToDelete = existingUser[0]!;

          // Check role hierarchy - ADMIN cannot delete SUPER_ADMIN
          if (!canManageUser(auth.user, targetUserToDelete.role as Role)) {
            return json(
              { error: "You cannot delete users with equal or higher role" },
              { status: 403 }
            );
          }

          // Delete the user
          await db.delete(usersSqlite).where(eq(usersSqlite.id, userId));

          return json({ success: true, message: "User deleted successfully" });
        } catch (error) {
          console.error("[DELETE /api/users/:userId] Error:", error);
          return json({ error: "Failed to delete user" }, { status: 500 });
        }
      },
    },
  },
});
