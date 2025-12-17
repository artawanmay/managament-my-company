/**
 * Clients API Routes
 * GET /api/clients - List clients with search, filter, sort
 * POST /api/clients - Create a new client
 *
 * Requirements:
 * - 3.1: Store client information
 * - 3.2: Display searchable, filterable, sortable table
 * - 3.3: Filter clients by status
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, like, or, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, clientStatusValues, type NewClient } from "@/lib/db/schema";
import {
  requireAuth,
  requireAuthWithCsrf,
  requireRole,
  handleAuthError,
  handleRoleError,
} from "@/lib/auth/middleware";
import { logError } from "@/lib/logger";
import { logClientCreated } from "@/lib/activity";
import { z } from "zod";
import { randomUUID } from "crypto";

// Zod schema for creating a client
const createClientSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  picName: z.string().max(255).optional().nullable(),
  email: z
    .string()
    .email("Invalid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  website: z
    .string()
    .url("Invalid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(clientStatusValues).default("PROSPECT"),
  notes: z.string().optional().nullable(),
});

// Query params schema
const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(clientStatusValues).optional(),
  sortBy: z
    .enum(["name", "status", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const Route = createFileRoute("/api/clients/")({
  server: {
    handlers: {
      /**
       * GET /api/clients
       * List clients with search, filter, and sort
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least MEMBER role to view clients
        const roleCheck = requireRole(auth.user, "MEMBER");
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get("search") || undefined,
            status: url.searchParams.get("status") || undefined,
            sortBy: url.searchParams.get("sortBy") || "createdAt",
            sortOrder: url.searchParams.get("sortOrder") || "desc",
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

          const { search, status, sortBy, sortOrder, page, limit } =
            parsed.data;
          const offset = (page - 1) * limit;

          // Build query conditions
          const conditions = [];

          if (search) {
            conditions.push(
              or(
                like(clients.name, `%${search}%`),
                like(clients.picName, `%${search}%`),
                like(clients.email, `%${search}%`)
              )
            );
          }

          if (status) {
            conditions.push(eq(clients.status, status));
          }

          // Build sort order
          const sortColumn = {
            name: clients.name,
            status: clients.status,
            createdAt: clients.createdAt,
            updatedAt: clients.updatedAt,
          }[sortBy];

          const orderFn = sortOrder === "asc" ? asc : desc;

          // Execute query with conditions
          let query = db.select().from(clients);

          if (conditions.length > 0) {
            // Apply all conditions with AND
            for (const condition of conditions) {
              if (condition) {
                query = query.where(condition) as typeof query;
              }
            }
          }

          const clientList = await query
            .orderBy(orderFn(sortColumn))
            .limit(limit)
            .offset(offset);

          // Get total count for pagination
          let countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(clients);

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
            data: clientList,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          logError("[GET /api/clients] Error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return json({ error: "Failed to fetch clients" }, { status: 500 });
        }
      },

      /**
       * POST /api/clients
       * Create a new client
       */
      POST: async ({ request }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        // Require at least MANAGER role to create clients
        const roleCheck = requireRole(auth.user, "MANAGER");
        const roleError = handleRoleError(roleCheck);
        if (roleError) return roleError;

        try {
          const body = await request.json();
          const parsed = createClientSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const clientData: NewClient = {
            id: randomUUID(),
            name: parsed.data.name,
            picName: parsed.data.picName || null,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            address: parsed.data.address || null,
            website: parsed.data.website || null,
            status: parsed.data.status,
            notes: parsed.data.notes || null,
          };

          const result = await db
            .insert(clients)
            .values(clientData)
            .returning();
          const newClient = result[0]!;

          // Log activity
          await logClientCreated(auth.user.id, newClient.id, newClient.name);

          return json({ data: newClient }, { status: 201 });
        } catch (error) {
          logError("[POST /api/clients] Error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return json({ error: "Failed to create client" }, { status: 500 });
        }
      },
    },
  },
});
