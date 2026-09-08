# Trokky API Reference

All endpoints are mounted at `/api` by default (configurable via `basePath`). Studio is served at `/studio`.

Authentication is required unless marked as **public**. Use either:
- `Authorization: Bearer <jwt-token>` (session-based)
- `Authorization: Bearer <api-token>` (server-to-server, 64-char hex)

All responses use the standard format:

```typescript
{
  success: boolean
  data?: T
  error?: { code: string, message: string, details?: unknown }
  meta?: { total?: number, page?: number, limit?: number, hasNext?: boolean, hasPrev?: boolean }
}
```

---

## Collections and Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/collections` | List all collections |
| GET | `/collections/:collection` | List documents (supports `limit`, `offset`, `filter`, `sort` query params) |
| POST | `/collections/:collection` | Create document |
| GET | `/collections/:collection/:id` | Get document by ID |
| PUT | `/collections/:collection/:id` | Update document |
| DELETE | `/collections/:collection/:id` | Delete document |

## Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Search content across collections (`q`, `collections`, `limit`, `offset`) |

## Statistics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats/:collection` | Collection statistics (document count, published/draft counts) |

## Media

| Method | Path | Description |
|--------|------|-------------|
| GET | `/media` | List media files (`limit`, `offset`, `type`) |
| POST | `/media/upload` | Upload files (`multipart/form-data`) |
| POST | `/media/bulk-delete` | Bulk delete media files |
| GET | `/media/:id` | Get media metadata |
| PUT | `/media/:id` | Update media metadata |
| GET | `/media/:id/file` | Serve original file |
| GET | `/media/:id/variants/:variant` | Serve processed variant (thumbnail, preview, etc.) |
| POST | `/media/:id/regenerate-variants` | Regenerate image variants |
| DELETE | `/media/:id` | Delete media file and all variants |

## Users (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users (`role`, `isActive`, `limit`, `offset`) |
| POST | `/users` | Create user |
| GET | `/users/:id` | Get user by ID |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| GET | `/users/by-username/:username` | Find user by username |
| GET | `/users/by-email/:email` | Find user by email |

## Authentication

### Core (public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with username/password |
| POST | `/auth/logout` | Logout and invalidate token |
| GET | `/auth/me` | Get current authenticated user |
| POST | `/auth/validate` | Validate a token |
| POST | `/auth/refresh` | Refresh an access token |

### Password Reset (public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/request-reset` | Request password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/verify-reset-token` | Verify reset token is valid |

### Change Password

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/change-password` | Change password (authenticated) |

### Google OAuth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/oauth/google/init` | Start Google OAuth flow (returns redirect URL) |
| POST | `/auth/oauth/google/callback` | Handle OAuth callback with authorization code |
| DELETE | `/auth/oauth/google/unlink` | Unlink Google account |
| GET | `/auth/oauth/status` | Get OAuth provider status for current user |

### Passkeys / WebAuthn

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/passkey/status` | Check if passkey authentication is enabled |
| POST | `/auth/passkey/register/options` | Get registration options (challenge) |
| POST | `/auth/passkey/register/verify` | Verify and save passkey registration |
| POST | `/auth/passkey/login/options` | Get login options (challenge) |
| POST | `/auth/passkey/login/verify` | Verify passkey login |
| GET | `/auth/passkey/credentials` | List registered passkey credentials |
| PATCH | `/auth/passkey/credentials/:credentialId` | Update credential (rename) |
| DELETE | `/auth/passkey/credentials/:credentialId` | Delete a passkey credential |

### Multi-Factor Authentication (MFA)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/mfa/status` | Get MFA status for current user |
| POST | `/auth/mfa/verify` | Verify MFA code during login |
| POST | `/auth/mfa/verify-backup` | Verify backup code during login |
| POST | `/auth/mfa/send-code` | Send email OTP code |

**TOTP setup:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/mfa/setup/totp` | Initialize TOTP setup (returns QR code / secret) |
| POST | `/auth/mfa/setup/totp/verify` | Verify TOTP code to complete setup |

**Email OTP setup:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/mfa/setup/email` | Initialize email OTP setup |
| POST | `/auth/mfa/setup/email/verify` | Verify email code to complete setup |

**Management:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/mfa/disable` | Disable a specific MFA method |
| POST | `/auth/mfa/disable-all` | Disable all MFA methods |
| POST | `/auth/mfa/backup-codes/regenerate` | Regenerate backup codes |

### Trusted Devices

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/mfa/trusted-devices` | List trusted devices |
| DELETE | `/auth/mfa/trusted-devices/:deviceId` | Revoke a trusted device |
| DELETE | `/auth/mfa/trusted-devices` | Revoke all trusted devices |

### Admin MFA

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/users/:userId/mfa/reset` | Admin: reset MFA for a user |

### CAPTCHA

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/captcha/status` | Get CAPTCHA configuration (provider, site key) |

### Password hashing (`security.cryptoOptions`)

Configured in `trokky.config.ts` / `TrokkyExpress.create()`, not over HTTP.

| Option | Default | Description |
|--------|---------|-------------|
| `adapterType` | `'auto'` | `'node'` (bcrypt), `'webcrypto'` (PBKDF2), or `'auto'` |
| `saltRounds` | `12` | bcrypt cost factor, Node adapter only |
| `pbkdf2Iterations` | `100000` | PBKDF2 iteration count, WebCrypto adapter only |

New PBKDF2 hashes are stored in the versioned format `$pbkdf2-sha256$<iterations>$<salt>$<dk>`, so the iteration count travels with each hash and raising `pbkdf2Iterations` never invalidates existing passwords. Legacy untagged PBKDF2 hashes and bcrypt hashes still verify; any hash that is not PBKDF2 at the current iteration count is transparently rehashed on the user's next successful password login.

## OAuth2 Authorization Server

Implements RFC 8628 (Device Authorization Grant) and Authorization Code flow.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/device` | Start device authorization (returns device_code, user_code, verification_uri) |
| GET | `/auth/device/verify` | Get device code info for user verification page |
| POST | `/auth/device/verify` | User approves/denies device authorization |
| POST | `/auth/token` | Token endpoint (device_code, authorization_code, refresh_token grants) |
| GET | `/auth/authorize` | Validate authorization request parameters |
| POST | `/auth/authorize` | Handle user authorization decision |

## API Tokens

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tokens` | List API tokens |
| POST | `/tokens` | Create API token |
| GET | `/tokens/:id` | Get token details |
| PUT | `/tokens/:id` | Update token |
| DELETE | `/tokens/:id` | Delete token |

## Audit Logs (Read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit-logs/documents/:documentId` | Audit trail for a document |
| GET | `/audit-logs/collections/:collection` | Audit trail for a collection |
| GET | `/audit-logs/actors/:actorId` | Activity log for a user/actor |

## Webhooks (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/webhooks` | List webhooks |
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks/:id` | Get webhook details |
| PUT | `/webhooks/:id` | Update webhook |
| DELETE | `/webhooks/:id` | Delete webhook |
| GET | `/webhooks/:id/deliveries` | Get delivery history |
| POST | `/webhooks/:id/test` | Send test webhook |

## Configuration

| Method | Path | Description |
|--------|------|-------------|
| GET | `/schemas/:schemaName` | Get schema definition |
| GET | `/config/structure` | Get Studio navigation structure |
| GET | `/config/studio` | Get Studio configuration |
| GET | `/config/settings` | Get CMS settings |
| PUT | `/config/settings` | Update CMS settings (admin) |

## Utility

| Method | Path | Description |
|--------|------|-------------|
| GET | `/slugs/check-unique` | Check slug uniqueness (`slug`, `collection`, `excludeId`) |
| GET | `/health` | Health check (public) |
| GET | `/openapi.json` | OpenAPI 3.0 spec (public) -- import into Postman, Insomnia, etc. |
| OPTIONS | `/*` | CORS preflight (public) |

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request / validation error |
| 401 | Missing or invalid authentication |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limited |
| 500 | Internal server error |
