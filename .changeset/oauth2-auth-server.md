---
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/trokky": patch
"@trokky/express": patch
"@trokky/studio": patch
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
  - Auto-opens browser for authorization

- Added DeviceAuthPage to @trokky/studio:
  - Device authorization UI for CLI login flow
  - Shows requested scopes and client info
  - Authorize/Deny buttons with close window option

- Updated @trokky/express integration:
  - Added oauth2 config support to TrokkyConfig
  - Pass oauth2 config to TrokkyCore initialization

- Updated `trokky create` command:
  - Include OAuth2 server config in generated projects
  - Add OAUTH2_ISSUER to .env.example

- Cleaned up scripts directory:
  - Removed obsolete scripts
  - Updated install-git-hooks.js with documentation
