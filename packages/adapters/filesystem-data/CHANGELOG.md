# @trokky/adapter-filesystem-data

## 0.1.10

### Patch Changes

- 9e60ba7: Fix ESM import issues by adding explicit .js extensions to relative imports

  Node.js ESM requires explicit .js extensions for relative imports. This fix ensures proper module resolution when using these packages in ESM environments.

## 2.0.2

### Patch Changes

- 84a8782: Fix internal dependency version constraints

  Replace wildcard (\*) dependencies with proper semver constraints to prevent version mismatch issues when installing packages. This ensures that packages requiring features from specific versions (like expandDocumentReferences in @trokky/core@2.0.0) will correctly resolve to compatible versions.
  - @trokky/core: ^2.0.0
  - @trokky/types: ^0.1.0
  - @trokky/routes: ^2.0.0
  - @trokky/mail: ^0.1.0
  - @trokky/i18n: ^0.2.0
  - @trokky/fields: ^0.4.0
  - @trokky/studio: ^0.4.0
  - @trokky/adapter-filesystem-data: ^2.0.0
  - @trokky/adapter-filesystem-media: ^2.0.0

- Updated dependencies [84a8782]
  - @trokky/core@2.0.5

## 2.0.1

### Patch Changes

- 094c150: Fix document status being reset to draft on update
  - Routes: Preserve `_status` from existing document when updating unless explicitly provided in update data
  - Adapter: Use `_status` from update data if provided, otherwise preserve existing status

## 2.0.0

### Patch Changes

- Updated dependencies [4351835]
  - @trokky/core@2.0.0

## 1.0.0

### Patch Changes

- Updated dependencies [3bbba91]
  - @trokky/core@1.0.0

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
