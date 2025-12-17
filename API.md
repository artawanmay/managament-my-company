# API Documentation

## Overview

The MMC App API is a RESTful API built with TanStack Start. All endpoints are prefixed with `/api/`.

## Authentication

### Session-Based Auth

The API uses session-based authentication with cookies:

- **Session Cookie**: `session_id` (HttpOnly, Secure, SameSite=Strict)
- **CSRF Token**: Required for mutation requests via `x-csrf-token` header

### Getting CSRF Token

The CSRF token is returned in the login response and should be stored client-side for subsequent mutation requests.

## Common Response Formats

### Success Response

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": { ... }
}
```

## Endpoints

### Authentication

#### POST /api/auth/login

Authenticate user and create session.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "ADMIN"
  },
  "csrfToken": "token-string"
}
```

**Error (401):** Invalid credentials
**Error (429):** Account locked

#### POST /api/auth/logout

Invalidate current session.

**Headers:** `x-csrf-token: <token>`

**Response (200):**

```json
{ "success": true }
```

#### GET /api/auth/session

Validate current session and get user info.

**Response (200):**

```json
{
  "authenticated": true,
  "user": { ... },
  "csrfToken": "token-string"
}
```

---

### Users

#### GET /api/users

List all users (ADMIN+ only).

**Query Parameters:**

- `search` - Search by name/email
- `role` - Filter by role
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

#### POST /api/users

Create new user (ADMIN+ only).

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "email": "new@example.com",
  "password": "password123",
  "name": "New User",
  "role": "MEMBER"
}
```

#### GET /api/users/:userId

Get user details.

#### PUT /api/users/:userId

Update user (ADMIN+ only).

**Headers:** `x-csrf-token: <token>`

#### DELETE /api/users/:userId

Delete user (ADMIN+ only).

**Headers:** `x-csrf-token: <token>`

#### PUT /api/users/:userId/role

Change user role (ADMIN+ only).

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{ "role": "MANAGER" }
```

#### GET /api/users/me

Get current user profile.

#### PUT /api/users/me

Update current user profile.

**Headers:** `x-csrf-token: <token>`

#### PUT /api/users/me/theme

Update theme preference.

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{ "theme": "dark" }
```

---

### Clients

#### GET /api/clients

List clients with filtering and sorting.

**Query Parameters:**

- `search` - Search by name/email/PIC
- `status` - Filter by status (PROSPECT, ACTIVE, INACTIVE, ARCHIVED)
- `sortBy` - Sort field (name, status, createdAt, updatedAt)
- `sortOrder` - asc/desc
- `page`, `limit` - Pagination

**Required Role:** MEMBER+

#### POST /api/clients

Create new client.

**Headers:** `x-csrf-token: <token>`
**Required Role:** ADMIN+

**Request:**

```json
{
  "name": "Client Name",
  "picName": "Contact Person",
  "email": "client@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "website": "https://example.com",
  "status": "PROSPECT",
  "notes": "Additional notes"
}
```

#### GET /api/clients/:clientId

Get client details.

#### PUT /api/clients/:clientId

Update client.

**Headers:** `x-csrf-token: <token>`
**Required Role:** ADMIN+

#### DELETE /api/clients/:clientId

Delete client.

**Headers:** `x-csrf-token: <token>`
**Required Role:** ADMIN+

---

### Projects

#### GET /api/projects

List projects (filtered by user access).

**Query Parameters:**

- `search` - Search by name/description
- `status` - Filter by status (PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, ARCHIVED)
- `priority` - Filter by priority (LOW, MEDIUM, HIGH, URGENT)
- `clientId` - Filter by client
- `includeArchived` - Include archived projects (default: false)
- `sortBy`, `sortOrder`, `page`, `limit`

**Required Role:** MEMBER+

#### POST /api/projects

Create new project.

**Headers:** `x-csrf-token: <token>`
**Required Role:** ADMIN+

**Request:**

```json
{
  "clientId": "uuid",
  "name": "Project Name",
  "description": "Project description",
  "status": "PLANNING",
  "priority": "MEDIUM",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T00:00:00Z",
  "managerId": "uuid"
}
```

#### GET /api/projects/:projectId

Get project details.

#### PUT /api/projects/:projectId

Update project.

**Headers:** `x-csrf-token: <token>`
**Required Role:** ADMIN+ or Project Manager

#### DELETE /api/projects/:projectId

Delete project.

**Headers:** `x-csrf-token: <token>`
**Required Role:** ADMIN+

#### POST /api/projects/:projectId/archive

Archive project.

**Headers:** `x-csrf-token: <token>`

#### GET /api/projects/:projectId/members

List project members.

#### POST /api/projects/:projectId/members

Add project member.

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "userId": "uuid",
  "role": "MEMBER"
}
```

#### DELETE /api/projects/:projectId/members/:userId

Remove project member.

**Headers:** `x-csrf-token: <token>`

#### GET /api/projects/:projectId/activity

Get project activity log.

#### GET /api/projects/:projectId/files

List project files.

---

### Tasks

#### GET /api/tasks

List tasks with filtering.

**Query Parameters:**

- `search` - Search by title/description
- `projectId` - Filter by project
- `status` - Filter by status (BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE)
- `priority` - Filter by priority
- `assigneeId` - Filter by assignee
- `sortBy`, `sortOrder`, `page`, `limit`

#### POST /api/tasks

Create new task.

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "projectId": "uuid",
  "title": "Task Title",
  "description": "Task description",
  "status": "BACKLOG",
  "priority": "MEDIUM",
  "assigneeId": "uuid",
  "dueDate": "2024-06-30T00:00:00Z",
  "estimatedHours": 8
}
```

#### GET /api/tasks/:taskId

Get task details.

#### PUT /api/tasks/:taskId

Update task.

**Headers:** `x-csrf-token: <token>`

#### DELETE /api/tasks/:taskId

Delete task.

**Headers:** `x-csrf-token: <token>`

#### POST /api/tasks/:taskId/move

Move task (Kanban drag-drop).

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "status": "IN_PROGRESS",
  "order": 2
}
```

#### GET /api/tasks/:taskId/comments

List task comments.

#### POST /api/tasks/:taskId/comments

Add comment to task.

**Headers:** `x-csrf-token: <token>`

---

### Notes

#### GET /api/notes

List notes.

**Query Parameters:**

- `projectId` - Filter by project
- `clientId` - Filter by client
- `type` - Filter by type (GENERAL, CREDENTIAL, API_KEY, CONFIG)

#### POST /api/notes

Create note.

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "projectId": "uuid",
  "title": "Note Title",
  "content": "Note content",
  "type": "CREDENTIAL",
  "secretValue": "sensitive-data"
}
```

#### GET /api/notes/:noteId

Get note details.

#### PUT /api/notes/:noteId

Update note.

**Headers:** `x-csrf-token: <token>`

#### DELETE /api/notes/:noteId

Delete note.

**Headers:** `x-csrf-token: <token>`

#### GET /api/notes/:noteId/secret

View decrypted secret (logged).

**Required Permission:** view_secrets

---

### Comments

#### PUT /api/comments/:commentId

Update comment.

**Headers:** `x-csrf-token: <token>`

#### DELETE /api/comments/:commentId

Delete comment.

**Headers:** `x-csrf-token: <token>`

---

### Tags

#### GET /api/tags

List all tags.

#### POST /api/tags

Create tag.

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "name": "Tag Name",
  "color": "#FF5733"
}
```

#### PUT /api/tags/:tagId

Update tag.

**Headers:** `x-csrf-token: <token>`

#### DELETE /api/tags/:tagId

Delete tag.

**Headers:** `x-csrf-token: <token>`

#### POST /api/tags/:tagId/attach

Attach tag to entity.

**Headers:** `x-csrf-token: <token>`

**Request:**

```json
{
  "entityType": "TASK",
  "entityId": "uuid"
}
```

#### POST /api/tags/:tagId/detach

Detach tag from entity.

**Headers:** `x-csrf-token: <token>`

---

### Files

#### GET /api/files/:fileId

Get file metadata.

#### GET /api/files/:fileId/download

Download file.

#### DELETE /api/files/:fileId

Delete file.

**Headers:** `x-csrf-token: <token>`

---

### Notifications

#### GET /api/notifications

List user notifications.

**Query Parameters:**

- `unreadOnly` - Show only unread (default: false)
- `page`, `limit`

#### POST /api/notifications/:notificationId/read

Mark notification as read.

**Headers:** `x-csrf-token: <token>`

---

### Search

#### GET /api/search

Global search across entities.

**Query Parameters:**

- `q` - Search query (required)
- `types` - Entity types to search (clients, projects, tasks, notes)

**Response:**

```json
{
  "results": {
    "clients": [...],
    "projects": [...],
    "tasks": [...],
    "notes": [...]
  }
}
```

---

### Dashboard

#### GET /api/dashboard

Get dashboard statistics.

**Response:**

```json
{
  "stats": {
    "totalClients": 50,
    "totalProjects": 25,
    "totalTasks": 150,
    "overdueTasks": 5
  },
  "tasksByStatus": {...},
  "projectsByStatus": {...},
  "recentActivity": [...]
}
```

---

### Activity

#### GET /api/activity

Get activity log.

**Query Parameters:**

- `entityType` - Filter by entity type
- `entityId` - Filter by entity ID
- `page`, `limit`

---

### Real-time (SSE)

#### GET /api/realtime/notifications

Server-Sent Events stream for user notifications.

**Response:** SSE stream with notification events.

#### GET /api/realtime/projects/:projectId

Server-Sent Events stream for project updates.

**Response:** SSE stream with task/project update events.

---

## Error Codes

| Status | Description                             |
| ------ | --------------------------------------- |
| 400    | Bad Request - Invalid input             |
| 401    | Unauthorized - Not authenticated        |
| 403    | Forbidden - Insufficient permissions    |
| 404    | Not Found - Resource doesn't exist      |
| 429    | Too Many Requests - Rate limited/locked |
| 500    | Internal Server Error                   |

## Rate Limiting

- Login attempts: 5 per 15 minutes per email
- API requests: No hard limit (subject to change)
