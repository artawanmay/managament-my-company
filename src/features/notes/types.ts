/**
 * Notes feature types
 */
import type { NoteType } from '@/lib/db/schema';

export type { NoteType } from '@/lib/db/schema';

export interface Note {
  id: string;
  type: NoteType;
  systemName: string;
  clientId: string | null;
  projectId: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteWithSecret extends Note {
  secret: string;
}

export interface CreateNoteInput {
  type: NoteType;
  systemName: string;
  clientId?: string | null;
  projectId?: string | null;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  secret: string;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateNoteInput {
  type?: NoteType;
  systemName?: string;
  clientId?: string | null;
  projectId?: string | null;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  secret?: string;
  metadata?: Record<string, unknown> | null;
}

export interface SecretViewResponse {
  noteId: string;
  systemName: string;
  secret: string;
}

export interface NotesListResponse {
  data: Note[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
