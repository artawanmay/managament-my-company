/**
 * Notes API functions
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
import type {
  Note,
  NotesListResponse,
  CreateNoteInput,
  UpdateNoteInput,
  SecretViewResponse,
} from "../types";

const API_BASE = "/api/notes";

export interface NotesListParams {
  search?: string;
  projectId?: string;
  clientId?: string;
  type?: string;
  sortBy?: "systemName" | "type" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Fetch notes with filters
 */
export async function fetchNotes(
  params: NotesListParams = {},
  csrfToken?: string
): Promise<NotesListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set("search", params.search);
  if (params.projectId) searchParams.set("projectId", params.projectId);
  if (params.clientId) searchParams.set("clientId", params.clientId);
  if (params.type) searchParams.set("type", params.type);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const url = `${API_BASE}?${searchParams.toString()}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to fetch notes" }));
    throw new Error(error.error || "Failed to fetch notes");
  }

  return response.json();
}

/**
 * Fetch a single note (without secret)
 */
export async function fetchNote(
  noteId: string,
  csrfToken?: string
): Promise<{ data: Note }> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE}/${noteId}`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to fetch note" }));
    throw new Error(error.error || "Failed to fetch note");
  }

  return response.json();
}

/**
 * View secret (decrypted) - logs access
 * Requirements: 7.3, 7.5
 */
export async function viewSecret(
  noteId: string,
  csrfToken?: string
): Promise<{ data: SecretViewResponse }> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE}/${noteId}/secret`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to view secret" }));
    throw new Error(error.error || "Failed to view secret");
  }

  return response.json();
}

/**
 * Create a new note
 */
export async function createNote(
  data: CreateNoteInput,
  csrfToken: string
): Promise<{ data: Note }> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to create note" }));
    throw new Error(error.error || "Failed to create note");
  }

  return response.json();
}

/**
 * Update an existing note
 */
export async function updateNote(
  noteId: string,
  data: UpdateNoteInput,
  csrfToken: string
): Promise<{ data: Note }> {
  const response = await fetch(`${API_BASE}/${noteId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to update note" }));
    throw new Error(error.error || "Failed to update note");
  }

  return response.json();
}

/**
 * Delete a note
 */
export async function deleteNote(
  noteId: string,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/${noteId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to delete note" }));
    throw new Error(error.error || "Failed to delete note");
  }

  return response.json();
}
