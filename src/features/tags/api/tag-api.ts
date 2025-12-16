/**
 * Tag API functions
 */
import type {
  Tag,
  Taggable,
  CreateTagInput,
  UpdateTagInput,
  AttachTagInput,
  DetachTagInput,
} from '../types';

const API_BASE = '/api/tags';

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TagListParams {
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Fetch all tags with optional filtering
 */
export async function fetchTags(params?: TagListParams): Promise<PaginatedResponse<Tag>> {
  const searchParams = new URLSearchParams();

  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const queryString = searchParams.toString();
  const url = queryString ? `${API_BASE}?${queryString}` : API_BASE;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch tags' }));
    throw new Error(error.error || 'Failed to fetch tags');
  }

  return response.json();
}

/**
 * Fetch a single tag by ID
 */
export async function fetchTag(tagId: string): Promise<Tag> {
  const response = await fetch(`${API_BASE}/${tagId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch tag' }));
    throw new Error(error.error || 'Failed to fetch tag');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create a new tag
 */
export async function createTag(
  data: CreateTagInput,
  csrfToken: string
): Promise<Tag> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create tag' }));
    throw new Error(error.error || 'Failed to create tag');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update an existing tag
 */
export async function updateTag(
  tagId: string,
  data: UpdateTagInput,
  csrfToken: string
): Promise<Tag> {
  const response = await fetch(`${API_BASE}/${tagId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update tag' }));
    throw new Error(error.error || 'Failed to update tag');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string, csrfToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${tagId}`, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete tag' }));
    throw new Error(error.error || 'Failed to delete tag');
  }
}

/**
 * Attach a tag to an entity
 */
export async function attachTag(
  tagId: string,
  data: AttachTagInput,
  csrfToken: string
): Promise<Taggable> {
  const response = await fetch(`${API_BASE}/${tagId}/attach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to attach tag' }));
    throw new Error(error.error || 'Failed to attach tag');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Detach a tag from an entity
 */
export async function detachTag(
  tagId: string,
  data: DetachTagInput,
  csrfToken: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/${tagId}/detach`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to detach tag' }));
    throw new Error(error.error || 'Failed to detach tag');
  }
}
