---
title: Authentication
description: Configure users, roles, and permissions in Trokky
---

Trokky uses JWT-based authentication with role-based access control (RBAC) to secure your content API.

## Overview

The authentication system provides:

- JWT token-based authentication
- Role-based access control
- Secure password hashing
- Session management
- Multi-environment crypto support

## Quick Setup

### Basic Configuration

```typescript
const trokky = await TrokkyExpress.create({
  security: {
    adminUser: {
      username: 'admin',
      password: 'secure-password',
    },
    jwtSecret: process.env.JWT_SECRET || 'development-secret',
    tokenExpiry: '7d',
  },
  // ...
});
```

### Environment Variables

For production, use environment variables:

```bash
# .env
TROKKY_ADMIN_USERNAME=admin
TROKKY_ADMIN_PASSWORD=your-secure-password
TROKKY_JWT_SECRET=your-random-secret-key
```

```typescript
const trokky = await TrokkyExpress.create({
  security: {
    adminUser: {
      username: process.env.TROKKY_ADMIN_USERNAME,
      password: process.env.TROKKY_ADMIN_PASSWORD,
    },
    jwtSecret: process.env.TROKKY_JWT_SECRET,
  },
  // ...
});
```

## User Roles

Trokky includes four built-in roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | Full system access | All operations |
| `editor` | Content management | CRUD on all content |
| `writer` | Limited content management | Create/update own content |
| `viewer` | Read-only access | Read content only |

### Role Permissions Matrix

| Action | Admin | Editor | Writer | Viewer |
|--------|-------|--------|--------|--------|
| Read documents | Yes | Yes | Yes | Yes |
| Create documents | Yes | Yes | Yes | No |
| Update any document | Yes | Yes | No | No |
| Update own documents | Yes | Yes | Yes | No |
| Delete documents | Yes | Yes | No | No |
| Manage users | Yes | No | No | No |
| Access settings | Yes | No | No | No |
| Upload media | Yes | Yes | Yes | No |
| Delete media | Yes | Yes | No | No |

## User Management

### Creating Users Programmatically

```typescript
import { TrokkyCore } from '@trokky/core';

// After initialization
const user = await trokky.core.users.create({
  username: 'editor@example.com',
  password: 'user-password',
  role: 'editor',
  name: 'John Editor',
});
```

### User Storage

By default, users are stored alongside content using the configured storage adapter:

```
content/
└── _users/
    ├── admin.json
    └── editor@example.com.json
```

### User Document Structure

```json
{
  "_id": "user-abc123",
  "username": "editor@example.com",
  "passwordHash": "$2b$10$...",
  "role": "editor",
  "name": "John Editor",
  "createdAt": "2024-01-15T10:00:00Z",
  "lastLogin": "2024-01-20T14:30:00Z"
}
```

## Authentication Flow

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-abc123",
    "username": "admin",
    "role": "admin",
    "name": "Administrator"
  },
  "expiresAt": "2024-01-22T10:00:00Z"
}
```

### Using the Token

Include the token in subsequent requests:

```bash
GET /api/documents/post
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Refresh Token

```bash
POST /api/auth/refresh
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Logout

```bash
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Security Configuration

### Full Configuration Options

```typescript
const trokky = await TrokkyExpress.create({
  security: {
    // Admin user (created on first startup)
    adminUser: {
      username: 'admin',
      password: 'secure-password',
      email: 'admin@example.com',
    },

    // JWT settings
    jwtSecret: process.env.JWT_SECRET,
    tokenExpiry: '7d',           // Token lifetime
    refreshTokenExpiry: '30d',   // Refresh token lifetime

    // Password requirements
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: false,
    },

    // Rate limiting
    rateLimit: {
      login: {
        windowMs: 15 * 60 * 1000,  // 15 minutes
        max: 5,                     // 5 attempts
      },
    },

    // Session settings
    session: {
      maxConcurrent: 5,           // Max sessions per user
      revokeOnPasswordChange: true,
    },
  },
  // ...
});
```

## Protecting Routes

### Public vs Protected Endpoints

By default:
- `GET /api/documents/*` - Public (read access)
- `POST/PUT/DELETE /api/documents/*` - Protected (requires authentication)
- `GET /api/media/*` - Public
- `POST /api/media/*` - Protected
- `/api/auth/*` - Public (login/logout)
- `/api/users/*` - Admin only

### Custom Route Protection

```typescript
// In your Express app
import { requireAuth, requireRole } from '@trokky/express';

// Require any authenticated user
app.get('/api/custom', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Require specific role
app.post('/api/admin-only', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Require one of multiple roles
app.put('/api/editors', requireRole(['admin', 'editor']), (req, res) => {
  res.json({ message: 'Editor access granted' });
});
```

## Custom Authentication

### External Identity Providers

Integrate with OAuth providers:

```typescript
const trokky = await TrokkyExpress.create({
  security: {
    // ... other options

    oauth: {
      providers: [
        {
          name: 'google',
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackUrl: '/api/auth/google/callback',
        },
      ],
    },
  },
  // ...
});
```

### Custom User Validation

```typescript
const trokky = await TrokkyExpress.create({
  security: {
    // Custom validation before user creation
    validateUser: async (userData) => {
      // Check against external system
      const isAllowed = await checkExternalAuth(userData.email);
      if (!isAllowed) {
        throw new Error('User not authorized');
      }
      return true;
    },

    // Custom role assignment
    assignRole: async (userData) => {
      // Assign role based on email domain
      if (userData.email.endsWith('@admin.example.com')) {
        return 'admin';
      }
      return 'editor';
    },
  },
  // ...
});
```

## Security Best Practices

### JWT Secret

Generate a strong secret for production:

```bash
# Generate a secure random secret
openssl rand -base64 64
```

### Password Storage

Trokky uses bcrypt for password hashing with configurable cost factor:

```typescript
security: {
  bcryptRounds: 12,  // Higher = more secure but slower
}
```

### HTTPS

Always use HTTPS in production:

```typescript
// Force HTTPS redirect
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

### Cookie Settings

For cookie-based sessions:

```typescript
security: {
  cookie: {
    secure: true,        // HTTPS only
    httpOnly: true,      // No JavaScript access
    sameSite: 'strict',  // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  },
}
```

## Audit Logging

Track authentication events:

```typescript
const trokky = await TrokkyExpress.create({
  security: {
    auditLog: {
      enabled: true,
      events: ['login', 'logout', 'loginFailed', 'passwordChange', 'userCreate'],
    },
  },
  // ...
});

// Access audit logs
const logs = await trokky.core.audit.getEvents({
  type: 'loginFailed',
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),  // Last 24 hours
});
```

## Next Steps

- [Media Handling](/guides/media/) - Configure media uploads and processing
- [Studio Customization](/guides/studio/) - Customize the admin interface
- [Deployment](/guides/deployment/) - Deploy securely to production
