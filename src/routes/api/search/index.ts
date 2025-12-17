/**
 * Search API Route
 * GET /api/search - Global search across clients, projects, tasks, notes
 *
 * Requirements:
 * - 11.1: Query clients, projects, tasks, and notes matching the search term
 * - 11.2: Filter results to only include entities the user has permission to access
 * - 11.3: Group results by entity type with relevant preview information
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, like, or, desc, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  projects,
  tasks,
  notes,
  projectMembers,
} from "@/lib/db/schema";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { z } from "zod";

// Query params schema
const searchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(100),
  limit: z.coerce.number().min(1).max(20).default(5),
});

// Search result types
export interface ClientSearchResult {
  id: string;
  name: string;
  email: string | null;
  status: string;
}

export interface ProjectSearchResult {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
}

export interface TaskSearchResult {
  id: string;
  title: string;
  status: string;
  projectId: string;
  projectName: string | null;
}

export interface NoteSearchResult {
  id: string;
  systemName: string;
  type: string;
  projectId: string | null;
  projectName: string | null;
}

export interface SearchResults {
  clients: ClientSearchResult[];
  projects: ProjectSearchResult[];
  tasks: TaskSearchResult[];
  notes: NoteSearchResult[];
}

export const Route = createFileRoute("/api/search/")({
  server: {
    handlers: {
      /**
       * GET /api/search
       * Global search with permission filtering
       */
      GET: async ({ request }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            q: url.searchParams.get("q") || "",
            limit: url.searchParams.get("limit") || "5",
          };

          const parsed = searchQuerySchema.safeParse(queryParams);
          if (!parsed.success) {
            return json(
              {
                error: "Invalid query parameters",
                details: parsed.error.flatten(),
              },
              { status: 400 }
            );
          }

          const { q: searchTerm, limit } = parsed.data;
          const searchPattern = `%${searchTerm}%`;

          // Determine accessible project IDs for the user
          let accessibleProjectIds: string[] | null = null; // null means all projects

          if (auth.user.role !== "SUPER_ADMIN") {
            // Non-SUPER_ADMIN users: filter by project membership or manager role
            const memberProjects = await db
              .select({ projectId: projectMembers.projectId })
              .from(projectMembers)
              .where(eq(projectMembers.userId, auth.user.id));

            const memberProjectIds = memberProjects.map((p) => p.projectId);

            const managedProjects = await db
              .select({ id: projects.id })
              .from(projects)
              .where(eq(projects.managerId, auth.user.id));

            const managedProjectIds = managedProjects.map((p) => p.id);

            accessibleProjectIds = [
              ...new Set([...memberProjectIds, ...managedProjectIds]),
            ];
          }

          // Search clients (only SUPER_ADMIN and MANAGER can see clients)
          let clientResults: ClientSearchResult[] = [];
          if (
            auth.user.role === "SUPER_ADMIN" ||
            auth.user.role === "MANAGER"
          ) {
            const clientSearchResults = await db
              .select({
                id: clients.id,
                name: clients.name,
                email: clients.email,
                status: clients.status,
              })
              .from(clients)
              .where(
                or(
                  like(clients.name, searchPattern),
                  like(clients.email, searchPattern),
                  like(clients.picName, searchPattern)
                )
              )
              .orderBy(desc(clients.updatedAt))
              .limit(limit);

            clientResults = clientSearchResults;
          }

          // Search projects (filtered by access)
          let projectResults: ProjectSearchResult[] = [];
          const projectConditions = [
            or(
              like(projects.name, searchPattern),
              like(projects.description, searchPattern)
            ),
          ];

          if (accessibleProjectIds !== null) {
            if (accessibleProjectIds.length === 0) {
              // User has no project access
              projectResults = [];
            } else {
              projectConditions.push(
                inArray(projects.id, accessibleProjectIds)
              );
              const projectSearchResults = await db
                .select({
                  id: projects.id,
                  name: projects.name,
                  status: projects.status,
                  clientName: clients.name,
                })
                .from(projects)
                .leftJoin(clients, eq(projects.clientId, clients.id))
                .where(and(...projectConditions.filter(Boolean)))
                .orderBy(desc(projects.updatedAt))
                .limit(limit);

              projectResults = projectSearchResults;
            }
          } else {
            // Admin users can see all projects
            const projectSearchResults = await db
              .select({
                id: projects.id,
                name: projects.name,
                status: projects.status,
                clientName: clients.name,
              })
              .from(projects)
              .leftJoin(clients, eq(projects.clientId, clients.id))
              .where(projectConditions[0])
              .orderBy(desc(projects.updatedAt))
              .limit(limit);

            projectResults = projectSearchResults;
          }

          // Search tasks (filtered by project access)
          let taskResults: TaskSearchResult[] = [];
          const taskConditions = [
            or(
              like(tasks.title, searchPattern),
              like(tasks.description, searchPattern)
            ),
          ];

          if (accessibleProjectIds !== null) {
            if (accessibleProjectIds.length === 0) {
              taskResults = [];
            } else {
              taskConditions.push(
                inArray(tasks.projectId, accessibleProjectIds)
              );
              const taskSearchResults = await db
                .select({
                  id: tasks.id,
                  title: tasks.title,
                  status: tasks.status,
                  projectId: tasks.projectId,
                  projectName: projects.name,
                })
                .from(tasks)
                .leftJoin(projects, eq(tasks.projectId, projects.id))
                .where(and(...taskConditions.filter(Boolean)))
                .orderBy(desc(tasks.updatedAt))
                .limit(limit);

              taskResults = taskSearchResults;
            }
          } else {
            const taskSearchResults = await db
              .select({
                id: tasks.id,
                title: tasks.title,
                status: tasks.status,
                projectId: tasks.projectId,
                projectName: projects.name,
              })
              .from(tasks)
              .leftJoin(projects, eq(tasks.projectId, projects.id))
              .where(taskConditions[0])
              .orderBy(desc(tasks.updatedAt))
              .limit(limit);

            taskResults = taskSearchResults;
          }

          // Search notes (filtered by project access)
          let noteResults: NoteSearchResult[] = [];
          const noteConditions = [
            or(
              like(notes.systemName, searchPattern),
              like(notes.host, searchPattern),
              like(notes.username, searchPattern)
            ),
          ];

          if (accessibleProjectIds !== null) {
            if (accessibleProjectIds.length === 0) {
              // Also include notes created by the user
              noteConditions.push(eq(notes.createdBy, auth.user.id));
            } else {
              noteConditions.push(
                or(
                  inArray(notes.projectId, accessibleProjectIds),
                  eq(notes.createdBy, auth.user.id)
                )
              );
            }
          }

          const noteSearchResults = await db
            .select({
              id: notes.id,
              systemName: notes.systemName,
              type: notes.type,
              projectId: notes.projectId,
              projectName: projects.name,
            })
            .from(notes)
            .leftJoin(projects, eq(notes.projectId, projects.id))
            .where(and(...noteConditions.filter(Boolean)))
            .orderBy(desc(notes.updatedAt))
            .limit(limit);

          noteResults = noteSearchResults;

          const results: SearchResults = {
            clients: clientResults,
            projects: projectResults,
            tasks: taskResults,
            notes: noteResults,
          };

          return json({ data: results });
        } catch (error) {
          console.error("[GET /api/search] Error:", error);
          return json({ error: "Failed to perform search" }, { status: 500 });
        }
      },
    },
  },
});
