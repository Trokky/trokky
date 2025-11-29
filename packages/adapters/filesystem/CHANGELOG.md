# @trokky/adapter-filesystem

## 0.1.3

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

## 0.1.2

### Patch Changes

- 2f7ef9b: Improve media deletion reliability and performance

  **CLI Improvements:**
  - Add parallel batch deletion (10 files at a time) for faster clean operations
  - Track failed deletions and display detailed error summary
  - Add verification step after deletion to detect orphaned files
  - Display batch progress during large delete operations

  **Adapter Improvements:**
  - Delete metadata files FIRST before physical files to prevent orphaned listings
  - Since listMedia() uses metadata as source of truth, this ensures failed file deletions don't appear in subsequent listings
  - Better error logging for filesystem issues during deletion

  **Benefits:**
  - 10x faster deletion for large media collections
  - More reliable cleanup - single clean run should now work in most cases
  - Better error reporting helps identify permission or I/O issues
  - Automatic retry suggestion for failed deletions

## 0.1.1

### Patch Changes

- Fix media deletion bug in filesystem adapter

  The deleteFile method was silently catching all errors during file deletion, making it impossible to detect when deletions failed. Now only ENOENT errors are ignored, while all other errors (permissions, I/O issues) are properly reported.

## 0.2.0

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
