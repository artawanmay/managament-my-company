/**
 * Client API functions
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import type {
  ClientListParams,
  ClientListResponse,
  ClientWithProjects,
  CreateClientInput,
  UpdateClientInput,
  Client,
} from '../types';

const API_BASE = '/api/clients';

/**
 * Fetch clients with search, filter, and sort
 */
export async function fetchClients(
  params: ClientListParams = {},
  csrfToken?: string
): Promise<ClientListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set('search', params.search);
  if (params.status) searchParams.set('status', params.status);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const url = `${API_BASE}?${searchParams.toString()}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch clients' }));
    throw new Error(error.error || 'Failed to fetch clients');
  }

  return response.json();
}

/**
 * Fetch a single client with projects
 */
export async function fetchClient(
  clientId: string,
  csrfToken?: string
): Promise<{ data: ClientWithProjects }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`${API_BASE}/${clientId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch client' }));
    throw new Error(error.error || 'Failed to fetch client');
  }

  return response.json();
}

/**
 * Create a new client
 */
export async function createClient(
  data: CreateClientInput,
  csrfToken: string
): Promise<{ data: Client }> {
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
    const error = await response.json().catch(() => ({ error: 'Failed to create client' }));
    throw new Error(error.error || 'Failed to create client');
  }

  return response.json();
}

/**
 * Update an existing client
 */
export async function updateClient(
  clientId: string,
  data: UpdateClientInput,
  csrfToken: string
): Promise<{ data: Client }> {
  const response = await fetch(`${API_BASE}/${clientId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update client' }));
    throw new Error(error.error || 'Failed to update client');
  }

  return response.json();
}

/**
 * Delete a client
 */
export async function deleteClient(
  clientId: string,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/${clientId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete client' }));
    throw new Error(error.error || 'Failed to delete client');
  }

  return response.json();
}
