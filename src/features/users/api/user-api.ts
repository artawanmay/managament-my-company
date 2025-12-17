/**
 * User API functions
 * Requirements: 2.2, 2.3
 */
import type {
  UserListParams,
  UserListResponse,
  User,
  CreateUserInput,
  UpdateUserInput,
  UpdateUserRoleInput,
} from "../types";

const API_BASE = "/api/users";

/**
 * Fetch users with search, filter, and sort
 */
export async function fetchUsers(
  params: UserListParams = {},
  csrfToken?: string
): Promise<UserListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set("search", params.search);
  if (params.role) searchParams.set("role", params.role);
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
      .catch(() => ({ error: "Failed to fetch users" }));
    throw new Error(error.error || "Failed to fetch users");
  }

  return response.json();
}

/**
 * Fetch a single user
 */
export async function fetchUser(
  userId: string,
  csrfToken?: string
): Promise<{ data: User }> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE}/${userId}`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to fetch user" }));
    throw new Error(error.error || "Failed to fetch user");
  }

  return response.json();
}

/**
 * Create a new user
 */
export async function createUser(
  data: CreateUserInput,
  csrfToken: string
): Promise<{ data: User }> {
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
      .catch(() => ({ error: "Failed to create user" }));
    throw new Error(error.error || "Failed to create user");
  }

  return response.json();
}

/**
 * Update an existing user
 */
export async function updateUser(
  userId: string,
  data: UpdateUserInput,
  csrfToken: string
): Promise<{ data: User }> {
  const response = await fetch(`${API_BASE}/${userId}`, {
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
      .catch(() => ({ error: "Failed to update user" }));
    throw new Error(error.error || "Failed to update user");
  }

  return response.json();
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  data: UpdateUserRoleInput,
  csrfToken: string
): Promise<{ data: User; message: string }> {
  const response = await fetch(`${API_BASE}/${userId}/role`, {
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
      .catch(() => ({ error: "Failed to update user role" }));
    throw new Error(error.error || "Failed to update user role");
  }

  return response.json();
}

/**
 * Delete a user
 */
export async function deleteUser(
  userId: string,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/${userId}`, {
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
      .catch(() => ({ error: "Failed to delete user" }));
    throw new Error(error.error || "Failed to delete user");
  }

  return response.json();
}
