/**
 * Profile API Routes
 * GET /api/profile - Get current user profile
 * PUT /api/profile - Update current user profile
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usersSqlite } from "@/lib/db/schema/users";
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from "@/lib/auth/middleware";
import { z } from "zod";

// Zod schema for updating profile
const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email").max(255).optional(),
  avatarUrl: z
    .string()
    .url("Invalid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const Route = createFileRoute("/api/profile/")({
  server: {
    handlers: {
      /**
       * GET /api/profile
       * Get current user profile
       */
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
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
            .where(eq(usersSqlite.id, auth.user.id))
            .limit(1);

          const user = userResult[0];
          if (!user) {
            return json({ error: "User not found" }, { status: 404 });
          }

          return json({ data: user });
        } catch (error) {
          console.error("[GET /api/profile] Error:", error);
          return json({ error: "Failed to fetch profile" }, { status: 500 });
        }
      },

      /**
       * PUT /api/profile
       * Update current user profile
       */
      PUT: async ({ request }) => {
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const body = await request.json();
          const parsed = updateProfileSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Check if email is being changed and if it's already in use
          if (parsed.data.email) {
            const existingUser = await db
              .select({ id: usersSqlite.id })
              .from(usersSqlite)
              .where(eq(usersSqlite.email, parsed.data.email))
              .limit(1);

            if (
              existingUser.length > 0 &&
              existingUser[0]!.id !== auth.user.id
            ) {
              return json(
                { error: "Email is already in use" },
                { status: 409 }
              );
            }
          }

          const updateData: Record<string, unknown> = {
            updatedAt: Math.floor(Date.now() / 1000),
          };

          if (parsed.data.name !== undefined)
            updateData.name = parsed.data.name;
          if (parsed.data.email !== undefined)
            updateData.email = parsed.data.email;
          if (parsed.data.avatarUrl !== undefined)
            updateData.avatarUrl = parsed.data.avatarUrl || null;

          const result = await db
            .update(usersSqlite)
            .set(updateData)
            .where(eq(usersSqlite.id, auth.user.id))
            .returning({
              id: usersSqlite.id,
              email: usersSqlite.email,
              name: usersSqlite.name,
              role: usersSqlite.role,
              avatarUrl: usersSqlite.avatarUrl,
              themePreference: usersSqlite.themePreference,
              createdAt: usersSqlite.createdAt,
              updatedAt: usersSqlite.updatedAt,
            });

          const updatedUser = result[0];
          if (!updatedUser) {
            return json({ error: "Failed to update profile" }, { status: 500 });
          }

          return json({ data: updatedUser });
        } catch (error) {
          console.error("[PUT /api/profile] Error:", error);
          return json({ error: "Failed to update profile" }, { status: 500 });
        }
      },
    },
  },
});
