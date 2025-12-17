/**
 * Note Secret API Route
 * GET /api/notes/:noteId/secret - Decrypt and return secret, log access
 *
 * Requirements:
 * - 7.3: Decrypt and display secret value when authorized user clicks "Show Secret"
 * - 7.4: Display "You don't have permission to view this secret" for unauthorized users
 * - 7.5: Log access in note_access_logs with user ID, action, timestamp, IP, and user agent
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes, noteAccessLogs, type NewNoteAccessLog } from "@/lib/db/schema";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { canViewNoteSecret } from "@/lib/auth/permissions";
import { decryptSecret } from "@/lib/security/crypto";
import { randomUUID } from "crypto";

/**
 * Extract client IP from request headers
 */
function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the list (client IP)
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback
  return "unknown";
}

/**
 * Extract user agent from request headers
 */
function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") || "unknown";
}

export const Route = createFileRoute("/api/notes/$noteId/secret")({
  server: {
    handlers: {
      /**
       * GET /api/notes/:noteId/secret
       * Decrypt and return secret, log access
       */
      GET: async ({ request, params }) => {
        // Authenticate user
        const auth = await requireAuth(request);
        const authError = handleAuthError(auth);
        if (authError || !auth.success)
          return authError ?? new Response("Unauthorized", { status: 401 });

        try {
          const { noteId } = params;

          // Check if note exists
          const noteResult = await db
            .select({
              id: notes.id,
              secret: notes.secret,
              systemName: notes.systemName,
            })
            .from(notes)
            .where(eq(notes.id, noteId))
            .limit(1);

          const note = noteResult[0];

          if (!note) {
            return json({ error: "Note not found" }, { status: 404 });
          }

          // Check if user can view the secret (Requirement 7.4)
          const canView = await canViewNoteSecret(auth.user, noteId);
          if (!canView) {
            return json(
              { error: "You don't have permission to view this secret" },
              { status: 403 }
            );
          }

          // Log the access (Requirement 7.5)
          const accessLog: NewNoteAccessLog = {
            id: randomUUID(),
            noteId: noteId,
            userId: auth.user.id,
            action: "VIEW_SECRET",
            ip: getClientIp(request),
            userAgent: getUserAgent(request),
          };

          await db.insert(noteAccessLogs).values(accessLog);

          // Decrypt the secret (Requirement 7.3)
          let decryptedSecret: string;
          try {
            decryptedSecret = decryptSecret(note.secret);
          } catch (error) {
            console.error(
              "[GET /api/notes/:noteId/secret] Decryption error:",
              error
            );
            return json({ error: "Failed to decrypt secret" }, { status: 500 });
          }

          return json({
            data: {
              noteId: note.id,
              systemName: note.systemName,
              secret: decryptedSecret,
            },
          });
        } catch (error) {
          console.error("[GET /api/notes/:noteId/secret] Error:", error);
          return json({ error: "Failed to fetch secret" }, { status: 500 });
        }
      },
    },
  },
});
