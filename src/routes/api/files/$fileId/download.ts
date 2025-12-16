/**
 * File Download API Route
 * GET /api/files/:fileId/download - Download a file
 *
 * Requirements:
 * - 13.3: Serve the file with appropriate headers
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { files } from '@/lib/db/schema';
import {
  requireAuth,
  handleAuthError,
  requireProjectAccess,
  handleProjectAccessError,
} from '@/lib/auth/middleware';
import { logError } from '@/lib/logger';
import * as fs from 'fs';

export const Route = createFileRoute('/api/files/$fileId/download')({
  server: {
    handlers: {
      /**
       * GET /api/files/:fileId/download
       * Download a file
       * Requirement 13.3
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

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
            })
            .from(files)
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

          // Check if file exists on disk
          if (!fs.existsSync(file.path)) {
            return json({ error: 'File not found on storage' }, { status: 404 });
          }

          // Read file from disk
          const fileBuffer = fs.readFileSync(file.path);

          // Return file with appropriate headers (Requirement 13.3)
          return new Response(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': file.mimeType,
              'Content-Length': file.size.toString(),
              'Content-Disposition': `attachment; filename="${encodeURIComponent(file.fileName)}"`,
              'Cache-Control': 'private, max-age=3600',
            },
          });
        } catch (error) {
          logError('[GET /api/files/:fileId/download] Error', { error: error instanceof Error ? error.message : String(error) });
          return json({ error: 'Failed to download file' }, { status: 500 });
        }
      },
    },
  },
});
