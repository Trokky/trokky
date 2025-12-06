---
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/trokky": patch
---

feat(auth): add OAuth2 Authorization Server for CLI login and SSO

- Added OAuth2 Authorization Server to @trokky/core:
  - Device Authorization Flow (RFC 8628) for CLI authentication
  - Authorization Code Flow with PKCE for external web app SSO
  - Token generation and refresh support
  - Built-in Trokky CLI client registration

- Added OAuth2 route handlers to @trokky/routes:
  - POST /auth/device - Start device authorization
  - GET/POST /auth/device/verify - Device code verification
  - POST /auth/token - Token endpoint (device code, auth code, refresh)
  - GET/POST /auth/authorize - Authorization endpoint for SSO

- Added `trokky login` command to @trokky/trokky:
  - Browser-based authentication using device flow
  - Automatic token storage in config file
  - Supports refresh tokens for long-lived sessions

- Updated config system to support OAuth2 tokens:
  - Added refreshToken field to instance config
  - Added authType field (api-token | oauth2)
  - Added tokenExpiresAt for expiration tracking
