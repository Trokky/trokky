# Trokky v2 Authentication & Authorization System

A comprehensive, production-ready authentication and authorization system supporting multiple authentication methods, granular permissions, and enterprise-grade security features.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [Permission System](#permission-system)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Security Features](#security-features)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

Trokky v2's authentication system provides:

- **Multiple Authentication Methods**: User sessions (JWT) and App tokens for API access
- **Role-Based Access Control (RBAC)**: Flexible role system with granular permissions
- **Enterprise Security**: Password hashing, JWT tokens, rate limiting, and audit trails
- **Framework Integration**: Express middleware with easy integration patterns

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Studio Users  │    │  API Consumers  │    │ Internal Services│
│   (JWT Tokens)  │    │  (App Tokens)   │    │ (Service Tokens)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   Authentication Service  │
                    │   + Permission System     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     Storage Adapter       │
                    │  (Users + App Tokens)     │
                    └───────────────────────────┘
```

## Authentication Methods

### 1. User Authentication (JWT Sessions)

For human users accessing the Studio interface.

**Features:**
- Short-lived access tokens (1 hour default)
- Long-lived refresh tokens (7 days default)
- Automatic token refresh
- Session management

**Usage:**
```typescript
// Login user
const result = await authService.authenticateUser(username, password)
if (result) {
  const { user, accessToken, refreshToken } = result
  // Store tokens and redirect to Studio
}

// Validate token
const validation = await authService.validateToken(accessToken)
if (validation.valid) {
  console.log('User:', validation.context.user)
}
```

### 2. App Token Authentication

For API consumers, build processes, and frontend applications.

**Features:**
- Long-lived tokens (no expiration by default)
- Scoped permissions per token
- Usage tracking and analytics
- Easy revocation

**Usage:**
```typescript
// Create app token
const tokenResult = await authService.createAppToken({
  name: 'Blog Frontend',
  description: 'Token for blog website to fetch content',
  permissions: ['content:read', 'media:read']
}, createdByUserId)

// Use app token in API requests
curl -H "X-API-Token: your_app_token_here" \
     https://api.example.com/api/content
```

## Permission System

### Granular Permissions

Permissions follow a `resource:action` format for fine-grained control:

```typescript
// Content permissions
'content:read'     // View content
'content:write'    // Create/edit content
'content:delete'   // Delete content
'content:publish'  // Publish content

// Media permissions
'media:read'       // View media
'media:upload'     // Upload files
'media:edit'       // Edit metadata
'media:delete'     // Delete files

// User management
'users:read'       // View users
'users:write'      // Create/edit users
'users:delete'     // Delete users
'users:invite'     // Invite new users

// Settings and administration
'settings:read'    // View settings
'settings:write'   // Modify settings
'studio:access'    // Access Studio interface

// Token management
'tokens:read'      // View app tokens
'tokens:write'     // Create/edit tokens
'tokens:delete'    // Delete tokens
```

### Built-in Roles

```typescript
// Admin - Full system access
const adminPermissions = [
  'content:read', 'content:write', 'content:delete', 'content:publish',
  'media:read', 'media:upload', 'media:edit', 'media:delete',
  'users:read', 'users:write', 'users:delete', 'users:invite',
  'settings:read', 'settings:write', 'studio:access',
  'tokens:read', 'tokens:write', 'tokens:delete'
]

// Editor - Content and media management
const editorPermissions = [
  'content:read', 'content:write', 'content:delete', 'content:publish',
  'media:read', 'media:upload', 'media:edit', 'media:delete',
  'studio:access'
]

// Author - Content creation and basic media
const authorPermissions = [
  'content:read', 'content:write', 'content:publish',
  'media:read', 'media:upload',
  'studio:access'
]

// Viewer - Read-only access
const viewerPermissions = [
  'content:read', 'media:read', 'studio:access'
]
```

## Quick Start

### 1. Initialize Authentication Service

```typescript
import { AuthenticationService, DEFAULT_AUTH_CONFIG } from '@trokky/core/security'

const authService = new AuthenticationService({
  ...DEFAULT_AUTH_CONFIG,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: '1h',
  refreshTokenExpiresIn: '7d',
  bcryptRounds: 12
})
```

### 2. Set Up Express Middleware

```typescript
import { createAuthMiddleware } from '@trokky/core/security'
import express from 'express'

const app = express()

// Create middleware
const auth = createAuthMiddleware({
  authService,
  getUserById: async (id) => storage.getUser(id),
  getAppTokenByHash: async (hash) => storage.getAppTokenByHash(hash)
})

// Apply authentication to all routes
app.use(auth.authenticate)

// Protect Studio routes
app.use('/studio', auth.studioAuth())

// Protect admin routes
app.use('/admin', auth.adminAuth())

// Protect specific endpoints
app.get('/api/content', 
  auth.requirePermission('content:read'),
  (req, res) => {
    // Handler has access to req.auth
    console.log('User:', req.auth?.user)
  }
)
```

### 3. Create Admin User

```typescript
import { ROLE_PERMISSIONS } from '@trokky/core/types'

const adminUser = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'secure-password',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin' as const,
  permissions: ROLE_PERMISSIONS.admin,
  isActive: true
}

const hashedPassword = await authService.hashPassword(adminUser.password)
const user = await storage.saveUser('admin-id', {
  ...adminUser,
  passwordHash: hashedPassword
})
```

## API Reference

### AuthenticationService

#### Core Methods

```typescript
class AuthenticationService {
  // Password management
  async hashPassword(password: string): Promise<string>
  async verifyPassword(password: string, hash: string): Promise<boolean>
  
  // JWT tokens
  async generateUserToken(user: User): Promise<{
    accessToken: string
    refreshToken: string
  }>
  async validateToken(token: string): Promise<TokenValidationResult>
  
  // App tokens
  async generateAppToken(): Promise<{ token: string; hash: string }>
  async createAppToken(data: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult>
  async validateAppToken(token: string): Promise<{ valid: boolean; hash?: string }>
  
  // Permissions
  hasPermission(context: AuthContext, permission: Permission): boolean
  hasAnyPermission(context: AuthContext, permissions: Permission[]): boolean
  hasAllPermissions(context: AuthContext, permissions: Permission[]): boolean
  
  // Rate limiting
  isRateLimited(identifier: string): boolean
  recordFailedAttempt(identifier: string): void
  clearFailedAttempts(identifier: string): void
}
```

### Middleware

```typescript
// Individual middleware
auth.authenticate         // Parse and validate tokens
auth.requireAuth          // Require any authentication
auth.optionalAuth         // Parse tokens but don't require them
auth.requirePermission(permission)
auth.requireAnyPermission(permissions)
auth.requireAllPermissions(permissions)
auth.requireAdmin         // Admin users only
auth.requireStudioAccess  // Studio access permission

// Combined middleware
auth.studioAuth()         // authenticate + requireAuth + requireStudioAccess
auth.adminAuth()          // authenticate + requireAuth + requireAdmin
auth.authAndPermission(permission)  // authenticate + requireAuth + requirePermission
```

## Security Features

### Password Security

- **bcrypt hashing** with configurable salt rounds (default: 12)
- **Automatic salt generation** for each password
- **Timing attack protection** through bcrypt's built-in protections

### JWT Security

- **Short-lived access tokens** (1 hour default) for reduced exposure
- **Refresh tokens** for seamless user experience
- **Token validation** with signature verification
- **Configurable expiration** times

### App Token Security

- **Cryptographically secure** random token generation (32 bytes)
- **SHA-256 hashing** for secure storage
- **Scoped permissions** to limit token capabilities
- **Usage tracking** for audit trails

### Rate Limiting

- **Failed login attempt tracking** per identifier (username/email/IP)
- **Configurable thresholds** (default: 5 attempts in 15 minutes)
- **Automatic reset** after time window expires
- **Manual reset** on successful authentication

## Examples

### Frontend Integration

```typescript
// React hook for authentication
function useAuth() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('access_token'))
  
  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    
    const data = await response.json()
    if (data.success) {
      setToken(data.data.accessToken)
      setUser(data.data.user)
      localStorage.setItem('access_token', data.data.accessToken)
      localStorage.setItem('refresh_token', data.data.refreshToken)
    }
  }
  
  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
  
  return { user, token, login, logout }
}
```

### API Client with App Token

```typescript
class ApiClient {
  constructor(private baseUrl: string, private appToken: string) {}
  
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-API-Token': this.appToken,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  async getContent() {
    return this.request('/api/content')
  }
  
  async uploadMedia(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    
    return this.request('/api/media', {
      method: 'POST',
      body: formData,
      headers: {} // Don't set Content-Type for FormData
    })
  }
}

// Usage
const client = new ApiClient('https://api.example.com', 'your_app_token')
const content = await client.getContent()
```

### Custom Permission Checks

```typescript
// Check permissions in your business logic
function checkUserCanEditContent(authContext: AuthContext, contentId: string): boolean {
  // Admin can edit anything
  if (authContext.type === 'user' && authContext.user.role === 'admin') {
    return true
  }
  
  // Must have content:write permission
  if (!authService.hasPermission(authContext, 'content:write')) {
    return false
  }
  
  // Authors can only edit their own content
  if (authContext.type === 'user' && authContext.user.role === 'author') {
    return isContentOwnedBy(contentId, authContext.user.id)
  }
  
  return true
}
```

## Best Practices

### Security

1. **Use strong JWT secrets** in production
2. **Set appropriate token expiration** times
3. **Implement HTTPS** for all authentication endpoints
4. **Store refresh tokens securely** (HttpOnly cookies recommended)
5. **Validate all permissions** server-side
6. **Log authentication events** for audit trails
7. **Use rate limiting** to prevent brute force attacks

### App Tokens

1. **Create tokens with minimal permissions** needed
2. **Use descriptive names** for easy management
3. **Regularly audit and rotate** tokens
4. **Monitor token usage** for unusual activity
5. **Revoke unused tokens** immediately

### Performance

1. **Cache user data** to avoid repeated database queries
2. **Use middleware efficiently** - apply auth only where needed
3. **Implement token blacklisting** for immediate revocation
4. **Consider Redis** for session storage in distributed systems

### Error Handling

1. **Return consistent error formats**
2. **Don't leak sensitive information** in error messages
3. **Log detailed errors** server-side for debugging
4. **Implement graceful degradation** for auth failures

### Testing

1. **Test all permission combinations**
2. **Mock authentication** in unit tests
3. **Test rate limiting** behavior
4. **Verify token expiration** handling
5. **Test error scenarios** thoroughly

## Troubleshooting

### Common Issues

**Invalid JWT tokens:**
- Check JWT secret configuration
- Verify token hasn't expired
- Ensure proper token format (Bearer prefix)

**Permission denied errors:**
- Verify user has required permissions
- Check role assignments
- Validate permission strings match exactly

**Rate limiting triggers:**
- Clear failed attempts after successful login
- Adjust rate limiting thresholds if needed
- Check for automated requests causing issues

**App token authentication fails:**
- Verify X-API-Token header is set correctly
- Check token hasn't been revoked or expired
- Ensure token has required permissions

### Debug Mode

Enable detailed logging:

```typescript
const authService = new AuthenticationService({
  ...DEFAULT_AUTH_CONFIG,
  // Add debug logging
})

// Monitor authentication events
app.use((req, res, next) => {
  console.log('Auth context:', req.auth)
  next()
})
```

For more detailed troubleshooting, check the authentication service logs and ensure all dependencies (bcrypt, jsonwebtoken) are properly installed.