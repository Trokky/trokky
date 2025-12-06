# Trokky API Reference

This is the definitive API documentation for Trokky CMS. All endpoints are available under the configured API base path (default: `/api`).

## Table of Contents

- [Authentication](#authentication)
- [Document Operations](#document-operations)
- [Media Operations](#media-operations)
- [User Management](#user-management)
- [Authentication Endpoints](#authentication-endpoints)
- [OAuth2 Authorization Server](#oauth2-authorization-server)
- [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
- [CAPTCHA Protection](#captcha-protection)
- [App Tokens](#app-tokens)
- [Webhooks](#webhooks)
- [Configuration](#configuration)
- [Error Handling](#error-handling)

---

## Authentication

Trokky supports multiple authentication methods:

### JWT Token Authentication
```http
Authorization: Bearer <jwt_token>
```

### App Token Authentication
```http
Authorization: Bearer <app_token>
```

### Session Authentication (Studio)
```http
Cookie: trokky_session=<session_token>
```

### User Roles & Permissions
- **admin**: Full access to all operations including user management
- **editor**: Can read, write, and upload media
- **viewer**: Read-only access to content

---

## Document Operations

### List Documents
```http
GET /api/documents/:collection
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Number of documents to return |
| `offset` | number | 0 | Number of documents to skip |
| `filter` | JSON | - | Filter criteria |
| `sort` | string | - | Sort field and direction (e.g., `_createdAt_DESC`) |
| `select` | string | - | Comma-separated fields to include |

**Response:**
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Single Document
```http
GET /api/documents/:collection/:id
```

### Create Document
```http
POST /api/documents/:collection
Content-Type: application/json
```

### Update Document
```http
PUT /api/documents/:collection/:id
Content-Type: application/json
```

### Delete Document
```http
DELETE /api/documents/:collection/:id
```

---

## Media Operations

### Upload Media
```http
POST /api/media/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (File) - The media file to upload
- `alt` (string, optional) - Alt text for images
- `caption` (string, optional) - Caption text

### List Media
```http
GET /api/media
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | - | Filter by media type (image, video, document) |
| `limit` | number | 50 | Number of items to return |
| `offset` | number | 0 | Number of items to skip |

### Get Media
```http
GET /api/media/:id
```

### Delete Media
```http
DELETE /api/media/:id
```

---

## User Management

**Required Permission:** Admin role or `users:read`/`users:write` permission

### List Users
```http
GET /api/users
```

### Create User
```http
POST /api/users
```

### Get User
```http
GET /api/users/:id
```

### Update User
```http
PUT /api/users/:id
```

### Delete User
```http
DELETE /api/users/:id
```

### Get User by Username
```http
GET /api/users/by-username/:username
```

### Get User by Email
```http
GET /api/users/by-email/:email
```

---

## Authentication Endpoints

### Login
```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePassword123!",
  "rememberMe": false,
  "captchaToken": "optional-if-captcha-enabled"
}
```

**Response (success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "editor"
  },
  "expiresAt": "2024-01-16T10:30:00Z"
}
```

**Response (MFA required):**
```json
{
  "success": true,
  "data": {
    "mfaRequired": true,
    "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "availableMethods": [
      { "type": "totp", "enabled": true }
    ]
  }
}
```

### Logout
```http
POST /api/auth/logout
```

### Validate Token
```http
POST /api/auth/validate
```

### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

### Request Password Reset
```http
POST /api/auth/request-reset
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "captchaToken": "optional-if-captcha-enabled"
}
```

### Verify Password Reset
```http
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword456!"
}
```

---

## OAuth2 Authorization Server

Trokky can act as an OAuth2 Authorization Server, enabling:
- **CLI authentication** via Device Authorization Flow (RFC 8628)
- **External application SSO** via Authorization Code Flow with PKCE

### Server Metadata
```http
GET /api/.well-known/oauth-authorization-server
```

Returns OAuth2 server metadata per RFC 8414.

---

### Device Authorization Flow (RFC 8628)

Used by the Trokky CLI for browser-based authentication.

#### Start Device Authorization
```http
POST /api/auth/device
Content-Type: application/json
```

**Request Body:**
```json
{
  "client_id": "trokky-cli",
  "scope": "openid profile content:read content:write offline_access"
}
```

**Response:**
```json
{
  "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://cms.example.com/studio/auth/device",
  "verification_uri_complete": "https://cms.example.com/studio/auth/device?code=WDJB-MJHT",
  "expires_in": 600,
  "interval": 5
}
```

#### Get Device Code Info (Studio)
```http
GET /api/auth/device/verify?code=WDJB-MJHT
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "trokky-cli",
      "name": "Trokky CLI"
    },
    "scopes": ["openid", "profile", "content:read", "content:write"],
    "expiresAt": "2024-01-20T15:10:00Z"
  }
}
```

#### Authorize/Deny Device Code (Studio)
```http
POST /api/auth/device/verify
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body (approve):**
```json
{
  "user_code": "WDJB-MJHT",
  "action": "approve"
}
```

**Request Body (deny):**
```json
{
  "user_code": "WDJB-MJHT",
  "action": "deny"
}
```

#### Poll for Token (CLI)
```http
POST /api/auth/token
Content-Type: application/json
```

**Request Body:**
```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
  "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
  "client_id": "trokky-cli"
}
```

**Response (pending):**
```json
{
  "error": "authorization_pending",
  "error_description": "The authorization request is still pending"
}
```

**Response (success):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "openid profile content:read content:write offline_access"
}
```

---

### Authorization Code Flow with PKCE

Used by external web applications for SSO.

#### Initiate Authorization
```http
GET /api/auth/authorize?
  response_type=code&
  client_id=my-app&
  redirect_uri=https://myapp.com/callback&
  scope=openid%20profile&
  state=random-state&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256
```

**Response (validation passed):**
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "my-app",
      "name": "My Application",
      "description": "My awesome app"
    },
    "scopes": ["openid", "profile"],
    "redirectUri": "https://myapp.com/callback",
    "state": "random-state"
  }
}
```

#### Submit Authorization Decision
```http
POST /api/auth/authorize
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body (approve):**
```json
{
  "client_id": "my-app",
  "redirect_uri": "https://myapp.com/callback",
  "scope": "openid profile",
  "state": "random-state",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  "code_challenge_method": "S256",
  "action": "approve"
}
```

**Response (redirect):**
```
HTTP/1.1 302 Found
Location: https://myapp.com/callback?code=SplxlOBeZQQYbYS6WxSbIA&state=random-state
```

#### Exchange Authorization Code
```http
POST /api/auth/token
Content-Type: application/json
```

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "SplxlOBeZQQYbYS6WxSbIA",
  "client_id": "my-app",
  "redirect_uri": "https://myapp.com/callback",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

---

### Refresh Token
```http
POST /api/auth/token
Content-Type: application/json
```

**Request Body:**
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "client_id": "trokky-cli",
  "scope": "openid profile content:read"
}
```

---

### OAuth2 Scopes

| Scope | Description | Permissions |
|-------|-------------|-------------|
| `openid` | OpenID Connect | Basic identity |
| `profile` | User profile info | Read user profile |
| `email` | User email | Read user email |
| `content:read` | Read content | `content:read` |
| `content:write` | Write content | `content:write` |
| `content:delete` | Delete content | `content:delete` |
| `media:read` | Read media | `media:read` |
| `media:write` | Write media | `media:upload` |
| `users:read` | Read users | `users:read` |
| `users:write` | Write users | `users:write` |
| `settings:read` | Read settings | `settings:read` |
| `settings:write` | Write settings | `settings:write` |
| `offline_access` | Refresh tokens | Issues refresh token |

---

## Multi-Factor Authentication (MFA)

### Verify MFA Code
```http
POST /api/auth/mfa/verify
Content-Type: application/json
```

**Request Body:**
```json
{
  "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code": "123456",
  "method": "totp",
  "trustDevice": true
}
```

### Verify Backup Code
```http
POST /api/auth/mfa/verify-backup
```

### Send Email OTP
```http
POST /api/auth/mfa/send-code
```

### Initialize TOTP Setup
```http
POST /api/auth/mfa/setup/totp
Authorization: Bearer {token}
```

### Verify and Enable TOTP
```http
POST /api/auth/mfa/setup/totp/verify
Authorization: Bearer {token}
```

### Initialize Email OTP Setup
```http
POST /api/auth/mfa/setup/email
Authorization: Bearer {token}
```

### Verify and Enable Email OTP
```http
POST /api/auth/mfa/setup/email/verify
Authorization: Bearer {token}
```

### Get MFA Status
```http
GET /api/auth/mfa/status
Authorization: Bearer {token}
```

### Disable MFA Method
```http
POST /api/auth/mfa/disable
Authorization: Bearer {token}
```

### Disable All MFA
```http
POST /api/auth/mfa/disable-all
Authorization: Bearer {token}
```

### Regenerate Backup Codes
```http
POST /api/auth/mfa/backup-codes/regenerate
Authorization: Bearer {token}
```

### List Trusted Devices
```http
GET /api/auth/mfa/trusted-devices
Authorization: Bearer {token}
```

### Revoke Trusted Device
```http
DELETE /api/auth/mfa/trusted-devices/:deviceId
Authorization: Bearer {token}
```

### Revoke All Trusted Devices
```http
DELETE /api/auth/mfa/trusted-devices
Authorization: Bearer {token}
```

### Admin: Reset User MFA
```http
POST /api/admin/users/:userId/mfa/reset
Authorization: Bearer {admin_token}
```

---

## CAPTCHA Protection

### Get CAPTCHA Status
```http
GET /api/auth/captcha/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "config": {
      "provider": "turnstile",
      "siteKey": "0x4AAAAAAAxxxxxxxxxxxxxxxx"
    },
    "protectedEndpoints": {
      "login": true,
      "passwordResetRequest": true
    }
  }
}
```

---

## App Tokens

App tokens provide programmatic API access for integrations and automation.

### List Tokens
```http
GET /api/tokens
Authorization: Bearer {token}
```

### Create Token
```http
POST /api/tokens
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "CI/CD Integration",
  "permissions": ["content:read", "content:write", "media:upload"],
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

### Get Token
```http
GET /api/tokens/:id
Authorization: Bearer {token}
```

### Update Token
```http
PUT /api/tokens/:id
Authorization: Bearer {token}
```

### Delete Token
```http
DELETE /api/tokens/:id
Authorization: Bearer {token}
```

---

## Webhooks

### List Webhooks
```http
GET /api/webhooks
Authorization: Bearer {token}
```

### Create Webhook
```http
POST /api/webhooks
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Content Updates",
  "url": "https://myapp.com/webhooks/trokky",
  "events": ["document.created", "document.updated", "document.deleted"],
  "secret": "webhook-secret-for-verification"
}
```

### Get Webhook
```http
GET /api/webhooks/:id
Authorization: Bearer {token}
```

### Update Webhook
```http
PUT /api/webhooks/:id
Authorization: Bearer {token}
```

### Delete Webhook
```http
DELETE /api/webhooks/:id
Authorization: Bearer {token}
```

### Get Webhook Deliveries
```http
GET /api/webhooks/:id/deliveries
Authorization: Bearer {token}
```

### Test Webhook
```http
POST /api/webhooks/:id/test
Authorization: Bearer {token}
```

---

## Configuration

### Get Studio Configuration
```http
GET /api/config/studio
```

### Get Structure Configuration
```http
GET /api/config/structure
Authorization: Bearer {token}
```

### Get Settings
```http
GET /api/config/settings
Authorization: Bearer {token}
```

### Update Settings
```http
PUT /api/config/settings
Authorization: Bearer {token}
```

---

## Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T15:00:00Z"
}
```

---

## Schema Operations

### Get Schema
```http
GET /api/schemas/:schemaName
```

---

## Slug Validation

### Check Slug Uniqueness
```http
GET /api/slugs/check-unique?collection=blog-posts&slug=my-post&excludeId=optional-id
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Document validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `INVALID_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### OAuth2 Error Codes

| Code | Description |
|------|-------------|
| `invalid_request` | Malformed request |
| `invalid_client` | Unknown client |
| `invalid_grant` | Invalid authorization code or refresh token |
| `unauthorized_client` | Client not authorized for this grant type |
| `unsupported_grant_type` | Grant type not supported |
| `invalid_scope` | Invalid or unknown scope |
| `authorization_pending` | User hasn't completed authorization yet |
| `slow_down` | Polling too frequently |
| `access_denied` | User denied authorization |
| `expired_token` | Device code or authorization code expired |

---

## Rate Limiting

Default rate limits:
- **Authenticated requests**: 1000 requests per hour
- **Unauthenticated requests**: 100 requests per hour
- **Media uploads**: 50 uploads per hour

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

---

## CORS

Configure CORS in your `trokky.config.ts`:

```typescript
export default {
  server: {
    cors: {
      origin: ['http://localhost:3000', 'https://myapp.com'],
      credentials: true
    }
  }
}
```
