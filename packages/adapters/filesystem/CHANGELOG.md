# @trokky/adapter-filesystem

## 0.1.5

### Patch Changes

- 589e174: Fix media listing to show newly uploaded files and accurate pagination

  BREAKING CHANGE: `MediaStorageAdapter.listMedia()` now returns `MediaListResult` (`{ items, total }`) instead of `MediaFile[]`

  Changes:
  - Add default sorting by date descending (newest first) so new uploads appear at the top
  - Change `listMedia` return type to `MediaListResult` for accurate pagination
  - Update API response `meta` to include `total` count (total files in storage) alongside `count` (items in current page)
  - Fix `hasMore` calculation to use actual total count instead of page size comparison
  - Studio: Fetch all media files for proper client-side filtering and pagination
  - Studio: Fix StatsWidget to use `meta.total` for accurate media count
  - Studio: Add sort options (date, name, size) to Media Library
  - Studio: Add items per page selector (28, 56, 84, 112) to Media Library with validation
  - Studio: Increase default items per page from 24 to 56 (multiples of 7 for clean grid rows)
  - i18n: Add translations for sort options, pagination, and common.title

  Migration Guide:
  If you have implemented a custom MediaStorageAdapter, update your listMedia method:

  ```typescript
  // Before
  async listMedia(options?: MediaListOptions): Promise<MediaFile[]> {
    const files = await getFiles()
    return files
  }

  // After
  async listMedia(options?: MediaListOptions): Promise<MediaListResult> {
    const files = await getFiles()
    return { items: files, total: files.length }
  }
  ```

- Updated dependencies [589e174]
  - @trokky/core@0.1.29

## 0.1.4

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
