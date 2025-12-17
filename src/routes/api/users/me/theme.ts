/**
 * Theme Preference API Route
 * PUT /api/users/me/theme - Update user theme preference
 *
 * Requirements:
 * - 16.1: Light theme with white and blue styling
 * - 16.2: Dark theme with black and blue styling
 * - 16.3: Theme preference persisted and applied immediately
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  usersSqlite,
  themeValues,
  type ThemePreference,
} from "@/lib/db/schema/users";
import { requireAuthWithCsrf } from "@/lib/auth/middleware";

// Zod schema for theme update
const updateThemeSchema = z.object({
  theme: z.enum(themeValues, {
    message: "Theme must be light, dark, or system",
  }),
});

interface ThemeResponse {
  themePreference: ThemePreference;
}

export const Route = createFileRoute("/api/users/me/theme")({
  server: {
    handlers: {
      /**
       * PUT /api/users/me/theme
       * Update user theme preference
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
          const validation = updateThemeSchema.safeParse(body);

          if (!validation.success) {
            return json(
              {
                error: "Validation failed",
                details: validation.error.flatten(),
              },
              { status: 400 }
            );
          }

          const { theme } = validation.data;

          // Update user theme preference
          await db
            .update(usersSqlite)
            .set({
              themePreference: theme,
              updatedAt: new Date(),
            })
            .where(eq(usersSqlite.id, auth.user.id));

          const response: ThemeResponse = {
            themePreference: theme,
          };

          return json(response);
        } catch (error) {
          console.error("[PUT /api/users/me/theme] Error:", error);
          return json(
            { error: "Failed to update theme preference" },
            { status: 500 }
          );
        }
      },
    },
  },
});
