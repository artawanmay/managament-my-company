/**
 * Project Members API Routes
 * GET /api/projects/:projectId/members - List project members
 * POST /api/projects/:projectId/members - Add a member to project
 *
 * Requirements:
 * - 4.4: Assign members to project and grant access
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  projects,
  projectMembers,
  projectMemberRoleValues,
  users,
  type NewProjectMember,
} from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
  requireProjectAccess,
  requireProjectManagement,
  handleProjectAccessError,
} from '@/lib/auth/middleware';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Zod schema for adding a member
const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(projectMemberRoleValues).default('MEMBER'),
});

export const Route = createFileRoute('/api/projects/$projectId/members/')({
  server: {
    handlers: {
      /**
       * GET /api/projects/:projectId/members
       * List project members
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { projectId } = params;

          // Check project access
          const accessCheck = await requireProjectAccess(auth.user, projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Fetch project members with user info
          const members = await db
            .select({
              id: projectMembers.id,
              userId: projectMembers.userId,
              role: projectMembers.role,
              joinedAt: projectMembers.joinedAt,
              userName: users.name,
              userEmail: users.email,
              userAvatarUrl: users.avatarUrl,
              userRole: users.role,
            })
            .from(projectMembers)
            .leftJoin(users, eq(projectMembers.userId, users.id))
            .where(eq(projectMembers.projectId, projectId));

          return json({ data: members });
        } catch (error) {
          console.error('[GET /api/projects/:projectId/members] Error:', error);
          return json({ error: 'Failed to fetch project members' }, { status: 500 });
        }
      },

      /**
       * POST /api/projects/:projectId/members
       * Add a member to project
       */
      POST: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { projectId } = params;

          // Check project management access
          const accessCheck = await requireProjectManagement(auth.user, projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Check if project exists
          const projectExists = await db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          if (projectExists.length === 0) {
            return json({ error: 'Project not found' }, { status: 404 });
          }

          const body = await request.json();
          const parsed = addMemberSchema.safeParse(body);

          if (!parsed.success) {
            return json(
              { error: 'Validation failed', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          // Verify user exists
          const userExists = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, parsed.data.userId))
            .limit(1);

          if (userExists.length === 0) {
            return json({ error: 'User not found' }, { status: 404 });
          }

          // Check if user is already a member
          const existingMember = await db
            .select({ id: projectMembers.id })
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, parsed.data.userId)
              )
            )
            .limit(1);

          if (existingMember.length > 0) {
            return json({ error: 'User is already a member of this project' }, { status: 409 });
          }

          const memberData: NewProjectMember = {
            id: randomUUID(),
            projectId,
            userId: parsed.data.userId,
            role: parsed.data.role,
          };

          const result = await db.insert(projectMembers).values(memberData).returning();
          const newMember = result[0];

          // Fetch user info for response
          const userInfo = await db
            .select({
              name: users.name,
              email: users.email,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(eq(users.id, parsed.data.userId))
            .limit(1);

          return json(
            {
              data: {
                ...newMember,
                userName: userInfo[0]?.name,
                userEmail: userInfo[0]?.email,
                userAvatarUrl: userInfo[0]?.avatarUrl,
              },
            },
            { status: 201 }
          );
        } catch (error) {
          console.error('[POST /api/projects/:projectId/members] Error:', error);
          return json({ error: 'Failed to add project member' }, { status: 500 });
        }
      },
    },
  },
});
