# Security Documentation

## Overview

This document describes the security architecture and implementation details of the MMC App, covering authentication, authorization, encryption, and protection mechanisms.

## Authentication

### Session-Based Authentication

The application uses secure session-based authentication with the following characteristics:

- **Session Storage**: Sessions stored in database with unique IDs
- **Session Duration**: 7 days with automatic refresh
- **Session Refresh**: Automatically extended when less than 1 day remaining
- **Session ID**: 64-character hex string (256 bits of entropy)

### Password Security

Passwords are hashed using Argon2id, the recommended variant for password hashing:

```
Algorithm: argon2id
Memory Cost: 64 MiB
Time Cost: 3 iterations
Parallelism: 4 threads
```

### Login Flow

```
1. User submits email/password
2. Check if account is locked (Redis)
3. Verify password against stored hash
4. On success: Create session, clear failed attempts
5. On failure: Record failed attempt, check lockout threshold
```

### Account Lockout

Brute force protection is implemented using Redis:

| Parameter | Value |
|-----------|-------|
| Max Failed Attempts | 5 |
| Attempt Window | 15 minutes |
| Lockout Duration | 30 minutes |

After 5 failed login attempts within 15 minutes, the account is locked for 30 minutes.

## CSRF Protection

### Implementation

All mutation requests (POST, PUT, PATCH, DELETE) require CSRF token validation:

- **Token Generation**: 64-character hex string per session
- **Token Storage**: Stored with session in database
- **Token Transmission**: Via `x-csrf-token` header
- **Validation**: Constant-time comparison to prevent timing attacks

### Protected Endpoints

All API endpoints that modify data require CSRF tokens:
- User management
- Client/Project/Task CRUD
- Note creation and secret access
- File uploads
- Settings changes

## Authorization

### Role-Based Access Control (RBAC)

Five user roles with hierarchical permissions:

| Role | Level | Description |
|------|-------|-------------|
| SUPER_ADMIN | 4 | Full system access, can manage all users |
| ADMIN | 3 | Manage users (except SUPER_ADMIN), all projects |
| MANAGER | 2 | Manage assigned projects, view secrets |
| MEMBER | 1 | Create/edit tasks in assigned projects |
| GUEST | 0 | Read-only access to assigned projects |

### Permission Matrix

| Permission | SUPER_ADMIN | ADMIN | MANAGER | MEMBER | GUEST |
|------------|:-----------:|:-----:|:-------:|:------:|:-----:|
| manage_all_users | ✓ | | | | |
| manage_users | ✓ | ✓ | | | |
| manage_clients | ✓ | ✓ | | | |
| manage_projects | ✓ | ✓ | | | |
| manage_assigned_projects | ✓ | ✓ | ✓ | | |
| create_tasks | ✓ | ✓ | ✓ | ✓ | |
| edit_tasks | ✓ | ✓ | ✓ | ✓ | |
| view_secrets | ✓ | ✓ | ✓ | | |
| read_only | | | | | ✓ |

### Project-Level Roles

Users can have different roles within specific projects:

- **MANAGER**: Full project management
- **MEMBER**: Create and edit tasks
- **VIEWER**: Read-only access

### Access Control Rules

1. **Project Access**:
   - SUPER_ADMIN/ADMIN: All projects
   - MANAGER: Projects they manage
   - MEMBER/GUEST: Projects they're members of

2. **Note Access**:
   - SUPER_ADMIN/ADMIN: All notes
   - Others: Notes in accessible projects or self-created

3. **Secret Viewing**:
   - GUEST: Never
   - MEMBER: Own notes or project member notes
   - MANAGER+: All accessible notes

## Encryption

### Secret Storage (AES-256-GCM)

Sensitive data (credentials, API keys) is encrypted at rest:

```
Algorithm: AES-256-GCM
IV Length: 12 bytes (96 bits)
Auth Tag: 16 bytes (128 bits)
Salt: 16 bytes (128 bits)
Key Derivation: scrypt
```

### Encryption Format

Encrypted secrets are stored as Base64-encoded strings:

```
[salt (16 bytes)][iv (12 bytes)][authTag (16 bytes)][ciphertext]
```

### Key Management

- Encryption key stored in `ENCRYPTION_KEY` environment variable
- Key derived using scrypt for proper length
- Each encryption uses unique salt and IV

## Security Headers

Recommended headers for production deployment:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

## Session Cookie Configuration

```
Name: session_id
HttpOnly: true
Secure: true (production)
SameSite: Strict
Path: /
```

## Environment Variables

Required security-related environment variables:

| Variable | Description |
|----------|-------------|
| `ENCRYPTION_KEY` | Master key for AES-256-GCM encryption |
| `DATABASE_URL` | Database connection string |
| `REDIS_URL` | Redis connection for lockout tracking |

## Security Best Practices

1. **Input Validation**: All inputs validated with Zod schemas
2. **SQL Injection**: Prevented by Drizzle ORM parameterized queries
3. **XSS Prevention**: React's automatic escaping + CSP headers
4. **Timing Attacks**: Constant-time comparison for tokens
5. **Audit Logging**: All sensitive actions logged to activity_logs

## Incident Response

### Suspicious Activity Indicators

- Multiple failed login attempts
- Access from unusual locations
- Bulk data access patterns
- Unauthorized secret viewing attempts

### Response Actions

1. Account lockout (automatic after 5 failures)
2. Session invalidation (manual or automatic)
3. Activity log review
4. User notification (via notifications system)
