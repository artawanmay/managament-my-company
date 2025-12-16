/**
 * File feature types
 * Requirements: 13.1, 13.2
 */

export interface FileItem {
  id: string;
  projectId: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date | string;
  uploaderName?: string | null;
  uploaderEmail?: string | null;
}

export interface FileListResponse {
  data: FileItem[];
  projectId: string;
  projectName: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FileUploadResponse {
  data: FileItem;
}

export interface FileDeleteResponse {
  success: boolean;
  message: string;
}

// Allowed MIME types for file uploads
export const ALLOWED_MIME_TYPES = [
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
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// File type categories for display
export const FILE_TYPE_CATEGORIES: Record<string, string[]> = {
  Document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ],
  Spreadsheet: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
  Presentation: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  Image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  Archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
  Code: ['application/json', 'application/xml', 'text/html', 'text/css', 'text/javascript', 'application/javascript'],
};

export function getFileCategory(mimeType: string): string {
  for (const [category, types] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }
  return 'Other';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
