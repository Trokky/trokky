# @trokky/adapter-filesystem-data

## 0.1.1

### Patch Changes

- e2e16ad: Add Google OAuth support for Studio authentication (backend implementation)
  - Add OAuthProvider type and oauthProviders field to User model
  - Create GoogleOAuthService with PKCE support for secure OAuth flow
  - Add OAuth methods to TrokkyCore: linkOAuthProvider, unlinkOAuthProvider, authenticateWithOAuth, getUserByOAuthProvider
  - Add OAuth configuration to TrokkyConfig
  - Create OAuth route handlers: /auth/oauth/google/init, /auth/oauth/google/callback, /auth/oauth/google/unlink, /auth/oauth/status
  - Add getUserByOAuthProvider to postgres adapter with GIN index for efficient lookups
  - Add migration for oauth_providers column in users table
  - Add getUserByOAuthProvider to filesystem-data adapter with oauthProviders field support
  - Add getUserByOAuthProvider to legacy filesystem adapter

- Updated dependencies [e2e16ad]
  - @trokky/core@0.1.9

## 1.0.0

### Minor Changes

- Initial beta release

  Core functionality:
  - Complete CMS engine with business logic, schemas, validation, and storage coordination
  - Framework-agnostic HTTP handlers and route definitions
  - React-based admin Studio interface
  - Frontend SDK with TypeScript type generation
  - Express.js server integration with auto-mounting
  - File-based storage adapters with Git-friendly workflows
  - Field system with TypeScript-first definitions and Zod validation
  - Professional configuration system with organized sections
  - JWT-based authentication with role-based access control
  - Media processing with Sharp integration
