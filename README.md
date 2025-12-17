# MMC App

A full-stack project management application built with modern web technologies. Features client management, project tracking, task management with Kanban boards, secure credential storage, and real-time collaboration.

## Features

- **Client Management** - Track clients with contact info, status, and history
- **Project Management** - Organize projects with status, priority, and team members
- **Task Kanban Board** - Drag-and-drop task management with multiple statuses
- **Secure Notes & Credentials** - AES-256 encrypted storage for sensitive data
- **Real-time Updates** - Live notifications via Server-Sent Events
- **Role-Based Access Control** - Granular permissions (Super Admin, Admin, Manager, Member, Guest)
- **Activity Logging** - Full audit trail of all actions
- **Global Search** - Quick search across all entities
- **File Attachments** - Upload and manage project files
- **Comments & Collaboration** - Task discussions and team collaboration
- **Tagging System** - Organize items with custom tags
- **Dashboard Analytics** - Visual overview of projects and tasks

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TanStack Router, TanStack Query |
| UI | Radix UI, Tailwind CSS, shadcn/ui |
| Backend | TanStack Start (SSR), Node.js |
| Database | SQLite (dev) / PostgreSQL (prod), Drizzle ORM |
| Real-time | Server-Sent Events, Redis Pub/Sub |
| Auth | Session-based with CSRF protection |
| Testing | Vitest, fast-check (PBT), Playwright (E2E) |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Redis (optional, for real-time features)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd mmc-app

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run database migrations
npm run db:push

# Seed initial users
npm run db:seed

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Default Users

After seeding, these accounts are available:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | Super Admin |
| manager@example.com | manager123 | Manager |
| member@example.com | member123 | Member |

## Environment Variables

```bash
# Database (SQLite for dev, PostgreSQL for prod)
DATABASE_URL=file:./dev.db

# Session secret (32+ characters)
SESSION_SECRET=your-secret-key

# Encryption key for credentials (64 hex characters)
ENCRYPTION_KEY=your-encryption-key

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
PORT=3000
```

Generate secure keys:
```bash
# Session secret
openssl rand -base64 32

# Encryption key
openssl rand -hex 32
```

## Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Database
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
npm run db:seed      # Seed initial data

# Testing
npm run test         # Run unit/property tests
npm run test:watch   # Watch mode
npm run test:e2e     # Run E2E tests
npm run test:e2e:ui  # E2E with UI

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix lint issues
npm run format       # Format with Prettier
npm run typecheck    # TypeScript check
```

## Project Structure

```
src/
├── components/          # Shared UI components
│   ├── layout/         # Layout (sidebar, header)
│   └── ui/             # Base components (shadcn/ui)
├── features/           # Feature modules
│   ├── auth/           # Authentication
│   ├── clients/        # Client management
│   ├── projects/       # Project management
│   ├── tasks/          # Task & Kanban
│   ├── notes/          # Notes & credentials
│   ├── comments/       # Task comments
│   ├── tags/           # Tagging system
│   ├── files/          # File attachments
│   ├── notifications/  # Notifications
│   ├── activity/       # Activity logging
│   ├── search/         # Global search
│   ├── dashboard/      # Dashboard
│   └── users/          # User management
├── lib/                # Core libraries
│   ├── auth/           # Auth & permissions
│   ├── db/             # Database & schema
│   ├── realtime/       # SSE & Redis
│   ├── security/       # Encryption
│   └── validation/     # Zod schemas
├── routes/             # TanStack Router
│   ├── api/            # API endpoints
│   └── app/            # App pages
└── styles/             # Global styles
```

## Docker Deployment

For production deployment with Docker:

```bash
# Copy production env
cp .env.production.example .env

# Configure environment variables
# Edit .env with your values

# Start with Docker Compose
docker-compose up -d

# Check health
curl http://localhost/health
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## API Documentation

The API is RESTful with session-based authentication. All endpoints are prefixed with `/api/`.

Key endpoints:
- `POST /api/auth/login` - Authenticate
- `GET /api/clients` - List clients
- `GET /api/projects` - List projects
- `GET /api/tasks` - List tasks
- `GET /api/search?q=query` - Global search
- `GET /api/realtime/notifications` - SSE stream

See [API.md](API.md) for complete API documentation.

## Architecture

The application follows a feature-based architecture with:
- **Feature Modules** - Domain-driven code organization
- **Repository Pattern** - Database access via Drizzle ORM
- **Middleware Pattern** - Auth, CSRF, validation
- **Optimistic Updates** - Immediate UI feedback
- **Server-Sent Events** - Real-time without WebSocket complexity

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Testing

```bash
# Unit & Property-based tests
npm run test

# E2E tests (requires app running)
npm run test:e2e

# Coverage report
npm run test:coverage
```

Test structure:
- `tests/unit/` - Unit tests
- `tests/properties/` - Property-based tests (fast-check)
- `tests/integration/` - Integration tests
- `tests/e2e/` - Playwright E2E tests

## Security

- Session-based authentication with HttpOnly cookies
- CSRF protection on all mutations
- AES-256-GCM encryption for sensitive data
- Argon2 password hashing
- Role-based access control
- Account lockout after failed attempts

See [SECURITY.md](SECURITY.md) for security details.

## License

Private - All rights reserved
