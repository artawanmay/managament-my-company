/**
 * Project Member Removal API Route
 * DELETE /api/projects/:projectId/members/:userId - Remove a member from project
 *
 * Requirements:
 * - 4.5: Remove member and revoke access to project resources
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, projectMembers } from '@/lib/db/schema';
import {
  requireAuthWithCsrf,
  handleAuthError,
  requireProjectManagement,
  handleProjectAccessError,
} from '@/lib/auth/middleware';

export const Route = createFileRoute('/api/projects/$projectId/members/$userId')({
  server: {
    handlers: {
      /**
       * DELETE /api/projects/:projectId/members/:userId
       * Remove a member from project
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { projectId, userId } = params;

          // Check project management access
          const accessCheck = await requireProjectManagement(auth.user, projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Check if project exists
          const projectExists = await db
            .select({ id: projects.id, managerId: projects.managerId })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          const project = projectExists[0];
          if (!project) {
            return json({ error: 'Project not found' }, { status: 404 });
          }

          // Prevent removing the project manager from members
          if (project.managerId === userId) {
            return json(
              { error: 'Cannot remove the project manager. Change the manager first.' },
              { status: 400 }
            );
          }

          // Check if member exists
          const existingMember = await db
            .select({ id: projectMembers.id })
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, userId)
              )
            )
            .limit(1);

          if (existingMember.length === 0) {
            return json({ error: 'Member not found in this project' }, { status: 404 });
          }

          // Remove the member
          await db
            .delete(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, userId)
              )
            );

          return json({
            success: true,
            message: 'Member removed from project successfully',
          });
        } catch (error) {
          console.error('[DELETE /api/projects/:projectId/members/:userId] Error:', error);
          return json({ error: 'Failed to remove project member' }, { status: 500 });
        }
      },
    },
  },
});
