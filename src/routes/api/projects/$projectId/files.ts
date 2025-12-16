/**
 * Project Files API Routes
 * GET /api/projects/:projectId/files - List files for a project
 * POST /api/projects/:projectId/files - Upload a file to a project
 *
 * Requirements:
 * - 13.1: Validate file type and size before storing
 * - 13.2: Show sortable table with file name, size, type, uploader, and date
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq, desc, asc, like, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { files, projects, users, type NewFile } from '@/lib/db/schema';
import {
  requireAuth,
  requireAuthWithCsrf,
  handleAuthError,
  requireProjectAccess,
  handleProjectAccessError,
} from '@/lib/auth/middleware';
import { logActivity } from '@/lib/activity';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  // Code/Config
  'application/json',
  'application/xml',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
];

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Query params schema for listing files
const listQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['fileName', 'size', 'mimeType', 'uploadedAt']).default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Get file storage path from environment
function getStoragePath(): string {
  return process.env.FILE_STORAGE_PATH || './uploads';
}

// Ensure upload directory exists
function ensureUploadDir(projectId: string): string {
  const storagePath = getStoragePath();
  const projectDir = path.join(storagePath, projectId);
  
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
  
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  
  return projectDir;
}

export const Route = createFileRoute('/api/projects/$projectId/files')({
  server: {
    handlers: {
      /**
       * GET /api/projects/:projectId/files
       * List files for a project
       * Requirement 13.2
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

          // Verify project exists
          const projectExists = await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          if (projectExists.length === 0) {
            return json({ error: 'Project not found' }, { status: 404 });
          }

          // Parse query parameters
          const url = new URL(request.url);
          const queryParams = {
            search: url.searchParams.get('search') || undefined,
            sortBy: url.searchParams.get('sortBy') || 'uploadedAt',
            sortOrder: url.searchParams.get('sortOrder') || 'desc',
            page: url.searchParams.get('page') || '1',
            limit: url.searchParams.get('limit') || '20',
          };

          const parsed = listQuerySchema.safeParse(queryParams);
          if (!parsed.success) {
            return json(
              { error: 'Invalid query parameters', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { search, sortBy, sortOrder, page, limit } = parsed.data;
          const offset = (page - 1) * limit;

          // Build conditions
          const conditions = [eq(files.projectId, projectId)];

          if (search) {
            conditions.push(like(files.fileName, `%${search}%`));
          }

          // Build sort order
          const sortColumn = {
            fileName: files.fileName,
            size: files.size,
            mimeType: files.mimeType,
            uploadedAt: files.uploadedAt,
          }[sortBy];

          const orderFn = sortOrder === 'asc' ? asc : desc;

          // Execute query with uploader info
          const fileList = await db
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
            .where(and(...conditions))
            .orderBy(orderFn(sortColumn))
            .limit(limit)
            .offset(offset);

          // Get total count
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(files)
            .where(and(...conditions));
          const total = countResult[0]?.count ?? 0;

          return json({
            data: fileList,
            projectId,
            projectName: projectExists[0]!.name,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        } catch (error) {
          console.error('[GET /api/projects/:projectId/files] Error:', error);
          return json({ error: 'Failed to fetch files' }, { status: 500 });
        }
      },

      /**
       * POST /api/projects/:projectId/files
       * Upload a file to a project
       * Requirement 13.1
       */
      POST: async ({ request, params }) => {
        // Authenticate user with CSRF protection
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        // GUEST users cannot upload files
        if (auth.user.role === 'GUEST') {
          return json({ error: 'Access denied' }, { status: 403 });
        }

        try {
          const { projectId } = params;

          // Check project access
          const accessCheck = await requireProjectAccess(auth.user, projectId);
          const accessError = handleProjectAccessError(accessCheck);
          if (accessError) return accessError;

          // Verify project exists
          const projectExists = await db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          if (projectExists.length === 0) {
            return json({ error: 'Project not found' }, { status: 404 });
          }

          // Parse multipart form data
          const formData = await request.formData();
          const file = formData.get('file') as File | null;

          if (!file) {
            return json({ error: 'No file provided' }, { status: 400 });
          }

          // Validate file type (Requirement 13.1)
          if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return json(
              { error: 'File type not allowed', allowedTypes: ALLOWED_MIME_TYPES },
              { status: 400 }
            );
          }

          // Validate file size (Requirement 13.1)
          if (file.size > MAX_FILE_SIZE) {
            return json(
              { error: 'File too large', maxSize: MAX_FILE_SIZE, maxSizeMB: MAX_FILE_SIZE / (1024 * 1024) },
              { status: 400 }
            );
          }

          // Generate unique file ID and path
          const fileId = randomUUID();
          const fileExtension = path.extname(file.name) || '';
          const storedFileName = `${fileId}${fileExtension}`;
          const uploadDir = ensureUploadDir(projectId);
          const filePath = path.join(uploadDir, storedFileName);

          // Save file to disk
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          fs.writeFileSync(filePath, buffer);

          // Store file metadata in database
          const fileData: NewFile = {
            id: fileId,
            projectId,
            fileName: file.name,
            path: filePath,
            size: file.size,
            mimeType: file.type,
            uploadedBy: auth.user.id,
          };

          const result = await db.insert(files).values(fileData).returning();
          const newFile = result[0]!;

          // Log activity
          await logActivity({
            actorId: auth.user.id,
            entityType: 'FILE',
            entityId: newFile.id,
            action: 'CREATED',
            metadata: {
              projectId,
              fileName: file.name,
              size: file.size,
              mimeType: file.type,
            },
          });

          return json({ data: newFile }, { status: 201 });
        } catch (error) {
          console.error('[POST /api/projects/:projectId/files] Error:', error);
          return json({ error: 'Failed to upload file' }, { status: 500 });
        }
      },
    },
  },
});
