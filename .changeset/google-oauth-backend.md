---
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/adapter-postgres-data": patch
---

Add Google OAuth support for Studio authentication (backend implementation)

- Add OAuthProvider type and oauthProviders field to User model
- Create GoogleOAuthService with PKCE support for secure OAuth flow
- Add OAuth methods to TrokkyCore: linkOAuthProvider, unlinkOAuthProvider, authenticateWithOAuth, getUserByOAuthProvider
- Add OAuth configuration to TrokkyConfig
- Create OAuth route handlers: /auth/oauth/google/init, /auth/oauth/google/callback, /auth/oauth/google/unlink, /auth/oauth/status
- Add getUserByOAuthProvider to postgres adapter with GIN index for efficient lookups
- Add migration for oauth_providers column in users table
