/**
 * Profile Avatar API Route
 * POST /api/profile/avatar - Upload avatar image
 * DELETE /api/profile/avatar - Remove avatar
 */
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usersSqlite } from '@/lib/db/schema/users';
import { requireAuthWithCsrf, handleAuthError } from '@/lib/auth/middleware';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = 'uploads/avatars';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Ensure upload directory exists
function ensureUploadDir() {
  const dir = path.join(process.cwd(), UPLOAD_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const Route = createFileRoute('/api/profile/avatar')({
  server: {
    handlers: {
      /**
       * POST /api/profile/avatar
       * Upload avatar image
       */
      POST: async ({ request }) => {
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          const formData = await request.formData();
          const file = formData.get('avatar') as File | null;

          if (!file) {
            return json({ error: 'No file uploaded' }, { status: 400 });
          }

          // Validate file type
          if (!ALLOWED_TYPES.includes(file.type)) {
            return json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' }, { status: 400 });
          }

          // Validate file size
          if (file.size > MAX_FILE_SIZE) {
            return json({ error: 'File too large. Maximum size is 5MB' }, { status: 400 });
          }

          // Get file extension
          const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
          const fileName = `${auth.user.id}-${randomUUID()}.${ext}`;
          
          // Ensure upload directory exists
          const uploadDir = ensureUploadDir();
          const filePath = path.join(uploadDir, fileName);

          // Delete old avatar if exists
          const userResult = await db
            .select({ avatarUrl: usersSqlite.avatarUrl })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, auth.user.id))
            .limit(1);

          const oldAvatarUrl = userResult[0]?.avatarUrl;
          if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
            const oldFilePath = path.join(process.cwd(), oldAvatarUrl);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }

          // Save new file
          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(filePath, buffer);

          // Update user avatar URL
          const avatarUrl = `/${UPLOAD_DIR}/${fileName}`;
          await db
            .update(usersSqlite)
            .set({
              avatarUrl,
              updatedAt: new Date(),
            })
            .where(eq(usersSqlite.id, auth.user.id));

          return json({ data: { avatarUrl }, message: 'Avatar uploaded successfully' });
        } catch (error) {
          console.error('[POST /api/profile/avatar] Error:', error);
          return json({ error: 'Failed to upload avatar' }, { status: 500 });
        }
      },

      /**
       * DELETE /api/profile/avatar
       * Remove avatar
       */
      DELETE: async ({ request }) => {
        const auth = await requireAuthWithCsrf(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success) return authError ?? new Response('Unauthorized', { status: 401 });

        try {
          // Get current avatar
          const userResult = await db
            .select({ avatarUrl: usersSqlite.avatarUrl })
            .from(usersSqlite)
            .where(eq(usersSqlite.id, auth.user.id))
            .limit(1);

          const avatarUrl = userResult[0]?.avatarUrl;

          // Delete file if it's a local upload
          if (avatarUrl && avatarUrl.startsWith('/uploads/avatars/')) {
            const filePath = path.join(process.cwd(), avatarUrl);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }

          // Clear avatar URL in database
          await db
            .update(usersSqlite)
            .set({
              avatarUrl: null,
              updatedAt: new Date(),
            })
            .where(eq(usersSqlite.id, auth.user.id));

          return json({ success: true, message: 'Avatar removed successfully' });
        } catch (error) {
          console.error('[DELETE /api/profile/avatar] Error:', error);
          return json({ error: 'Failed to remove avatar' }, { status: 500 });
        }
      },
    },
  },
});
