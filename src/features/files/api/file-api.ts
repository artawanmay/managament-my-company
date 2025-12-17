/**
 * Files API functions
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
import type {
  FileItem,
  FileListResponse,
  FileUploadResponse,
  FileDeleteResponse,
} from "../types";

export interface FilesListParams {
  search?: string;
  sortBy?: "fileName" | "size" | "mimeType" | "uploadedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Fetch files for a project
 * Requirement 13.2
 */
export async function fetchFiles(
  projectId: string,
  params: FilesListParams = {},
  csrfToken?: string
): Promise<FileListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set("search", params.search);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const url = `/api/projects/${projectId}/files?${searchParams.toString()}`;
  const headers: HeadersInit = {};
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
      .catch(() => ({ error: "Failed to fetch files" }));
    throw new Error(error.error || "Failed to fetch files");
  }

  return response.json();
}

/**
 * Fetch a single file metadata
 */
export async function fetchFile(
  fileId: string,
  csrfToken?: string
): Promise<{ data: FileItem }> {
  const headers: HeadersInit = {};
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`/api/files/${fileId}`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to fetch file" }));
    throw new Error(error.error || "Failed to fetch file");
  }

  return response.json();
}

/**
 * Upload a file to a project
 * Requirement 13.1
 */
export async function uploadFile(
  projectId: string,
  file: File,
  csrfToken: string
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to upload file" }));
    throw new Error(error.error || "Failed to upload file");
  }

  return response.json();
}

/**
 * Download a file
 * Requirement 13.3
 */
export async function downloadFile(
  fileId: string,
  fileName: string,
  csrfToken?: string
): Promise<void> {
  const headers: HeadersInit = {};
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`/api/files/${fileId}/download`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to download file" }));
    throw new Error(error.error || "Failed to download file");
  }

  // Create a blob from the response and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Delete a file
 * Requirement 13.4
 */
export async function deleteFile(
  fileId: string,
  csrfToken: string
): Promise<FileDeleteResponse> {
  const response = await fetch(`/api/files/${fileId}`, {
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
      .catch(() => ({ error: "Failed to delete file" }));
    throw new Error(error.error || "Failed to delete file");
  }

  return response.json();
}
