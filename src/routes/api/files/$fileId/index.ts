/**
 * File API Routes
 * GET /api/files/:fileId - Get file metadata
 * DELETE /api/files/:fileId - Delete a file
 *
 * Requirements:
 * - 13.4: Remove the file after confirmation
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { files, users } from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
  requireProjectAccess,
  handleProjectAccessError,
} from '@/lib/auth/middleware';
import { logActivity } from '@/lib/activity';
import { logError } from '@/lib/logger';
import * as fs from 'fs';

export const Route = createFileRoute('/api/files/$fileId/')({
  server: {
    handlers: {
      /**
       * GET /api/files/:fileId
       * Get file metadata
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const { fileId } = params;

          // Fetch file metadata with uploader info
          const fileResult = await db
            .select({
              id: files.id,
              projectId: files.projectId,
              fileName: files.fileName,
              path: files.path,
              size: files.size,
              mimeType: files.mimeType,
              uploadedBy: files.uploadedBy,
              uploadedAt: files.uploadedAt,
              uploaderName: users.name,
              uploaderEmail: users.email,
            })
            .from(files)
            .leftJoin(users, eq(files.uploadedBy, users.id))
            .where(eq(files.id, fileId))
            .limit(1);

          if (fileResult.length === 0) {
            return json({ error: 'File not found' }, { status: 404 });
          }

          const file = fileResult[0]!;

          // Check project access
          const accessCheck = await requireProjectAccess(auth.user, file.projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          return json({ data: file });
        } catch (error) {
          logError('[GET /api/files/:fileId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to fetch file' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/files/:fileId
       * Delete a file
       * Requirement 13.4
       */
      DELETE: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // GUEST users cannot delete files
        if (auth.user.role === 'GUEST') {
          return json({ error: 'Access denied' }, { status: 403 });
        }

        try {
          const { fileId } = params;

          // Fetch file metadata
          const fileResult = await db
            .select({
              id: files.id,
              projectId: files.projectId,
              fileName: files.fileName,
              path: files.path,
              size: files.size,
              mimeType: files.mimeType,
              uploadedBy: files.uploadedBy,
            })
            .from(files)
            .where(eq(files.id, fileId))
            .limit(1);

          if (fileResult.length === 0) {
            return json({ error: 'File not found' }, { status: 404 });
          }

          const file = fileResult[0]!;

          // Check project access - need management access or be the uploader
          const accessCheck = await requireProjectAccess(auth.user, file.projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Only allow deletion if user can manage project or is the uploader
          const canDelete =
            accessCheck.success &&
            (accessCheck.canManage ||
              file.uploadedBy === auth.user.id ||
              auth.user.role === 'SUPER_ADMIN' ||
              auth.user.role === 'ADMIN');

          if (!canDelete) {
            return json({ error: 'You do not have permission to delete this file' }, { status: 403 });
          }

          // Delete file from disk
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          // Delete file record from database
          await db.delete(files).where(eq(files.id, fileId));

          // Log activity
          await logActivity({
            actorId: auth.user.id,
            entityType: 'FILE',
            entityId: fileId,
            action: 'DELETED',
            metadata: {
              projectId: file.projectId,
              fileName: file.fileName,
              size: file.size,
              mimeType: file.mimeType,
            },
          });

          return json({ success: true, message: 'File deleted successfully' });
        } catch (error) {
          logError('[DELETE /api/files/:fileId] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to delete file' }, { status: 500 });
        }
      },
    },
  },
});
