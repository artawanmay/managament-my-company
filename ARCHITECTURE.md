# Architecture Documentation

## System Overview

MMC App is a full-stack project management application built with modern web technologies. It provides client management, project tracking, task management with Kanban boards, secure credential storage, and real-time collaboration features.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TanStack Router, TanStack Query |
| UI Components | Radix UI, Tailwind CSS, shadcn/ui |
| Backend | TanStack Start (SSR), Node.js |
| Database | SQLite (dev) / PostgreSQL (prod) with Drizzle ORM |
| Real-time | Server-Sent Events (SSE), Redis Pub/Sub |
| Authentication | Session-based with CSRF protection |
| Testing | Vitest, fast-check (PBT), Playwright (E2E) |

## Project Structure

```
src/
├── components/           # Shared UI components
│   ├── layout/          # Layout components (sidebar, header)
│   └── ui/              # Base UI components (button, input, etc.)
├── features/            # Feature modules (domain-driven)
│   ├── auth/            # Authentication
│   ├── clients/         # Client management
│   ├── projects/        # Project management
│   ├── tasks/           # Task & Kanban
│   ├── notes/           # Notes & credentials
│   ├── comments/        # Task comments
│   ├── tags/            # Tagging system
│   ├── files/           # File attachments
│   ├── notifications/   # User notifications
│   ├── activity/        # Activity logging
│   ├── search/          # Global search
│   ├── dashboard/       # Dashboard analytics
│   ├── settings/        # User settings
│   └── users/           # User management
├── lib/                 # Core libraries
│   ├── auth/            # Authentication & authorization
│   ├── db/              # Database & schema
│   ├── errors/          # Error handling
│   ├── notifications/   # Notification service
│   ├── realtime/        # SSE & Redis pub/sub
│   ├── security/        # Encryption utilities
│   └── validation/      # Zod schemas
├── routes/              # TanStack Router routes
│   ├── api/             # API endpoints
│   └── app/             # App pages
└── styles/              # Global styles
```

## Feature Module Structure

Each feature follows a consistent structure:

```
feature/
├── api/                 # API client functions
├── components/          # Feature-specific components
├── hooks/               # React hooks (queries, mutations)
├── types.ts             # TypeScript types
└── index.ts             # Public exports
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  React Components → Hooks (useQuery/useMutation) → API Client   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TanStack Start Server                       │
├─────────────────────────────────────────────────────────────────┤
│  Route Handler → Auth Middleware → Validation → Business Logic  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  Drizzle ORM → SQLite/PostgreSQL                                │
│  Redis → Real-time Pub/Sub                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Entities

- **users** - User accounts with roles (SUPER_ADMIN, ADMIN, MANAGER, MEMBER, GUEST)
- **sessions** - Authentication sessions with CSRF tokens
- **clients** - Client organizations
- **projects** - Projects belonging to clients
- **project_members** - User-project associations with roles
- **tasks** - Tasks within projects (Kanban items)
- **notes** - Notes with optional encrypted secrets
- **comments** - Task comments
- **tags** - Tagging system
- **taggables** - Polymorphic tag associations
- **files** - File attachments
- **notifications** - User notifications
- **activity_logs** - Audit trail

### Entity Relationships

```
clients (1) ──────< projects (N)
                        │
                        ├──────< project_members (N) >────── users
                        │
                        ├──────< tasks (N)
                        │           │
                        │           └──────< comments (N)
                        │
                        ├──────< notes (N)
                        │
                        └──────< files (N)

tags (N) ──────< taggables (N) >────── (tasks, notes, projects)
```

## Real-time Architecture

The application uses Server-Sent Events (SSE) for real-time updates:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client A   │     │    Redis     │     │   Client B   │
│              │     │   Pub/Sub    │     │              │
│  SSE Stream  │◄────│              │◄────│  API Action  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### SSE Channels

- `/api/realtime/notifications` - User notifications
- `/api/realtime/projects/:projectId` - Project/task updates

## Component Architecture

### UI Component Hierarchy

```
App
├── Layout (Sidebar + Header)
│   ├── Navigation
│   ├── NotificationDropdown
│   └── CommandPalette (Search)
└── Page Content
    └── Feature Components
        └── UI Primitives (shadcn/ui)
```

### State Management

- **Server State**: TanStack Query for caching and synchronization
- **Form State**: React Hook Form with Zod validation
- **UI State**: React useState/useContext for local state

## Key Design Patterns

1. **Feature-based Architecture**: Code organized by domain features
2. **Repository Pattern**: Database access through Drizzle ORM
3. **Middleware Pattern**: Auth, CSRF, validation middleware
4. **Optimistic Updates**: Immediate UI feedback with rollback
5. **Server-Sent Events**: Real-time updates without WebSocket complexity
