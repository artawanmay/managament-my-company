/**
 * Users API Routes
 * GET /api/users - List users (admin only)
 * POST /api/users - Create a new user (admin only)
 *
 * Requirements:
 * - 2.2: SUPER_ADMIN has full control over all users
 * - 2.3: ADMIN can manage users excluding SUPER_ADMIN accounts
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, like, or, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usersSqlite, roleValues, type NewUser } from "@/lib/db/schema/users";
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
} from "@/lib/auth/middleware";
import { canManageUsers } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import { randomUUID } from "crypto";

// Zod schema for creating a user
const createUserSchema = z.object({
  email: z.string().email("Invalid email").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(100),
  role: z.enum(roleValues).default("MEMBER"),
  avatarUrl: z
    .string()
    .url("Invalid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

// Query params schema
const listQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(roleValues).optional(),
  sortBy: z.enum(["name", "email", "role", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const Route = createFileRoute("/api/users/")({
  server: {
    handlers: {
      /**
       * GET /api/users
       * List users with search, filter, and sort (admin only)
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least ADMIN role to list users
        if (!canManageUsers(auth.user)) {
          return json(
            { error: "Insufficient permissions to manage users" },
            { status: 403 }
          );
        }

        try {
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get("search") || undefined,
            role: url.searchParams.get("role") || undefined,
            sortBy: url.searchParams.get("sortBy") || "name",
            sortOrder: url.searchParams.get("sortOrder") || "asc",
            page: url.searchParams.get("page") || "1",
            limit: url.searchParams.get("limit") || "20",
          };

          const parsed = listQuerySchema.safeParse(queryParams);
          if (!parsed.success) {
            return json(
              {
                error: "Invalid query parameters",
                details: parsed.error.flatten(),
              },
              { status: 400 }
            );
          }

          const { search, role, sortBy, sortOrder, page, limit } = parsed.data;
          const offset = (page - 1) * limit;

          // Build query conditions
          const conditions = [];

          if (search) {
            conditions.push(
              or(
                like(usersSqlite.name, `%${search}%`),
                like(usersSqlite.email, `%${search}%`)
              )
            );
          }

          if (role) {
            conditions.push(eq(usersSqlite.role, role));
          }

          // Build sort order
          const sortColumn = {
            name: usersSqlite.name,
            email: usersSqlite.email,
            role: usersSqlite.role,
            createdAt: usersSqlite.createdAt,
          }[sortBy];

          const orderFn = sortOrder === "asc" ? asc : desc;

          // Execute query with conditions
          let query = db
            .select({
              id: usersSqlite.id,
              email: usersSqlite.email,
              name: usersSqlite.name,
              role: usersSqlite.role,
              avatarUrl: usersSqlite.avatarUrl,
              createdAt: usersSqlite.createdAt,
              updatedAt: usersSqlite.updatedAt,
            })
            .from(usersSqlite);

          if (conditions.length > 0) {
            for (const condition of conditions) {
              if (condition) {
                query = query.where(condition) as typeof query;
              }
            }
          }

          const userList = await query
            .orderBy(orderFn(sortColumn))
            .limit(limit)
            .offset(offset);

          // Get total count for pagination
          let countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(usersSqlite);

          if (conditions.length > 0) {
            for (const condition of conditions) {
              if (condition) {
                countQuery = countQuery.where(condition) as typeof countQuery;
              }
            }
          }

          const countResult = await countQuery;
          const total = countResult[0]?.count ?? 0;

          return json({
            data: userList.map((user) => ({
              ...user,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            })),
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          console.error("[GET /api/users] Error:", error);
          return json({ error: "Failed to fetch users" }, { status: 500 });
        }
      },

      /**
       * POST /api/users
       * Create a new user (admin only)
       */
      POST: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least ADMIN role to create users
        if (!canManageUsers(auth.user)) {
          return json(
            { error: "Insufficient permissions to create users" },
            { status: 403 }
          );
        }

        try {
          const body = await request.json();
          const parsed = createUserSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Check role hierarchy - ADMIN cannot create SUPER_ADMIN
          if (
            auth.user.role !== "SUPER_ADMIN" &&
            parsed.data.role === "SUPER_ADMIN"
          ) {
            return json(
              { error: "Only SUPER_ADMIN can create SUPER_ADMIN users" },
              { status: 403 }
            );
          }

          // Check if email already exists
          const existingUser = await db
            .select({ id: usersSqlite.id })
            .from(usersSqlite)
            .where(eq(usersSqlite.email, parsed.data.email))
            .limit(1);

          if (existingUser.length > 0) {
            return json({ error: "Email is already in use" }, { status: 409 });
          }

          // Hash password
          const passwordHash = await hashPassword(parsed.data.password);

          const userData: NewUser = {
            id: randomUUID(),
            email: parsed.data.email,
            passwordHash,
            name: parsed.data.name,
            role: parsed.data.role,
            avatarUrl: parsed.data.avatarUrl || null,
          };

          const result = await db
            .insert(usersSqlite)
            .values(userData)
            .returning({
              id: usersSqlite.id,
              email: usersSqlite.email,
              name: usersSqlite.name,
              role: usersSqlite.role,
              avatarUrl: usersSqlite.avatarUrl,
              createdAt: usersSqlite.createdAt,
              updatedAt: usersSqlite.updatedAt,
            });

          const newUser = result[0];

          if (!newUser) {
            return json({ error: "Failed to create user" }, { status: 500 });
          }

          return json(
            {
              data: {
                ...newUser,
                createdAt: newUser.createdAt,
                updatedAt: newUser.updatedAt,
              },
            },
            { status: 201 }
          );
        } catch (error) {
          console.error("[POST /api/users] Error:", error);
          return json({ error: "Failed to create user" }, { status: 500 });
        }
      },
    },
  },
});
