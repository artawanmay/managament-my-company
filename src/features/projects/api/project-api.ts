/**
 * Project API functions
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import type {
  ProjectListParams,
  ProjectListResponse,
  ProjectWithDetails,
  CreateProjectInput,
  UpdateProjectInput,
  AddMemberInput,
  ProjectMemberWithUser,
} from "../types";

const API_BASE = "/api/projects";

/**
 * Fetch projects list with filters
 */
export async function fetchProjects(
  params: ProjectListParams = {}
): Promise<ProjectListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.priority) searchParams.set("priority", params.priority);
  if (params.clientId) searchParams.set("clientId", params.clientId);
  if (params.includeArchived) searchParams.set("includeArchived", "true");
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const url = `${API_BASE}/?${searchParams.toString()}`;
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch projects");
  }

  return response.json();
}

/**
 * Fetch single project with details
 */
export async function fetchProject(
  projectId: string
): Promise<{ data: ProjectWithDetails }> {
  const response = await fetch(`${API_BASE}/${projectId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch project");
  }

  return response.json();
}

/**
 * Create a new project
 */
export async function createProject(
  data: CreateProjectInput,
  csrfToken: string
): Promise<{ data: ProjectWithDetails }> {
  const response = await fetch(`${API_BASE}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create project");
  }

  return response.json();
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectInput,
  csrfToken: string
): Promise<{ data: ProjectWithDetails }> {
  const response = await fetch(`${API_BASE}/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update project");
  }

  return response.json();
}

/**
 * Archive a project
 */
export async function archiveProject(
  projectId: string,
  csrfToken: string
): Promise<{ data: ProjectWithDetails; message: string }> {
  const response = await fetch(`${API_BASE}/${projectId}/archive`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to archive project");
  }

  return response.json();
}

/**
 * Fetch project members
 */
export async function fetchProjectMembers(
  projectId: string
): Promise<{ data: ProjectMemberWithUser[] }> {
  const response = await fetch(`${API_BASE}/${projectId}/members/`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch project members");
  }

  return response.json();
}

/**
 * Add a member to project
 */
export async function addProjectMember(
  projectId: string,
  data: AddMemberInput,
  csrfToken: string
): Promise<{ data: ProjectMemberWithUser }> {
  const response = await fetch(`${API_BASE}/${projectId}/members/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add project member");
  }

  return response.json();
}

/**
 * Remove a member from project
 */
export async function removeProjectMember(
  projectId: string,
  userId: string,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/${projectId}/members/${userId}`, {
    method: "DELETE",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to remove project member");
  }

  return response.json();
}
