/**
 * Current User Profile API Routes
 * GET /api/users/me - Get current user profile
 * PUT /api/users/me - Update current user profile
 *
 * Requirements:
 * - 16.3: User can change theme preference
 * - 16.4: User can update their profile (name, email)
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { usersSqlite } from "@/lib/db/schema/users";
import { requireAuth, requireAuthWithCsrf } from "@/lib/auth/middleware";
import { logError } from "@/lib/logger";

// Response type for user profile
interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  themePreference: string;
  createdAt: string;
  updatedAt: string;
}

// Zod schema for profile update
const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name is too long")
    .optional(),
  email: z.string().email("Invalid email address").optional(),
});

export const Route = createFileRoute("/api/users/me/")({
  server: {
    handlers: {
      /**
       * GET /api/users/me
       * Get current user profile
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        if (!auth.success) {
          return json({ error: auth.error }, { status: auth.status });
        }

        try {
          // Fetch full user profile
          const users = await db
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
            .where(eq(usersSqlite.id, auth.user.id))
            .limit(1);

          const user = users[0];

          if (!user) {
            return json({ error: "User not found" }, { status: 404 });
          }

          const response: UserProfileResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatarUrl,
            themePreference: user.themePreference,
            createdAt: new Date(user.createdAt * 1000).toISOString(),
            updatedAt: new Date(user.updatedAt * 1000).toISOString(),
          };

          return json(response);
        } catch (error) {
          logError("[GET /api/users/me] Error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return json(
            { error: "Failed to fetch user profile" },
            { status: 500 }
          );
        }
      },

      /**
       * PUT /api/users/me
       * Update current user profile (name, email)
       */
      PUT: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        if (!auth.success) {
          return json({ error: auth.error }, { status: auth.status });
        }

        try {
          // Parse and validate request body
          const body = await request.json();
          const validation = updateProfileSchema.safeParse(body);

          if (!validation.success) {
            return json(
              {
                error: "Validation failed",
                details: validation.error.flatten(),
              },
              { status: 400 }
            );
          }

          const { name, email } = validation.data;

          // Check if there's anything to update
          if (!name && !email) {
            return json({ error: "No fields to update" }, { status: 400 });
          }

          // If email is being changed, check for uniqueness
          if (email && email !== auth.user.email) {
            const existingUser = await db
              .select({ id: usersSqlite.id })
              .from(usersSqlite)
              .where(eq(usersSqlite.email, email))
              .limit(1);

            if (existingUser.length > 0) {
              return json(
                { error: "Email is already in use" },
                { status: 409 }
              );
            }
          }

          // Build update object
          const updateData: Record<string, unknown> = {
            updatedAt: Math.floor(Date.now() / 1000),
          };

          if (name) updateData.name = name;
          if (email) updateData.email = email;

          // Update user
          await db
            .update(usersSqlite)
            .set(updateData)
            .where(eq(usersSqlite.id, auth.user.id));

          // Fetch updated user
          const users = await db
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
            .where(eq(usersSqlite.id, auth.user.id))
            .limit(1);

          const user = users[0];

          if (!user) {
            return json(
              { error: "User not found after update" },
              { status: 500 }
            );
          }

          const response: UserProfileResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatarUrl,
            themePreference: user.themePreference,
            createdAt: new Date(user.createdAt * 1000).toISOString(),
            updatedAt: new Date(user.updatedAt * 1000).toISOString(),
          };

          return json(response);
        } catch (error) {
          logError("[PUT /api/users/me] Error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return json(
            { error: "Failed to update user profile" },
            { status: 500 }
          );
        }
      },
    },
  },
});
