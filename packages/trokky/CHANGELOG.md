# @trokky/trokky

## 0.2.0

### Minor Changes

- 1734482: Add --fields and --set options to documents CLI commands
  - `docs get --fields`: Select specific fields using dot-notation paths (e.g., `--fields title,meta.description`)
  - `docs update --set`: Update specific field paths without sending the whole document (e.g., `--set "title=New Title" --set "meta.published=true"`)

## 0.1.15

### Patch Changes

- 8cd5fb8: Add automatic OAuth2 token refresh for CLI commands
  - Automatically refresh expired access tokens using stored refresh tokens
  - Display "(token refreshed)" indicator when token is refreshed
  - Clear error message when refresh fails and re-login is required
  - 5-minute buffer to proactively refresh tokens before expiration

## 0.1.14

### Patch Changes

- b62f3ba: Add `trokky documents` command for quick content CRUD operations

  This new command provides a better developer experience for document manipulation,
  replacing the need to use curl for API interactions.

  Features:
  - `trokky docs list <collection>` - List documents with pagination, filtering, sorting
  - `trokky docs get <collection> [id]` - Get a single document by ID
  - `trokky docs create <collection>` - Create from file, stdin, or inline JSON
  - `trokky docs update <collection> [id]` - Full or partial updates with --patch
  - `trokky docs delete <collection> [ids...]` - Delete single or multiple documents

  Key capabilities:
  - Singleton support: ID is optional for singleton collections (auto-detected)
  - Instance display: Shows which configured instance is being used
  - Supports environment variables (TROKKY_URL, TROKKY_TOKEN) and configured instances
  - `--pretty` flag for colorized JSON output
  - `--ids-only` flag for piping to other commands (suppresses instance info)
  - `--quiet` flag for scripting
  - Stdin support for piped input
  - Bulk delete with confirmation prompt (skip with --confirm)
  - Better error messages: distinguishes "collection not found" from "not a singleton"

  Alias: `trokky docs` works as shorthand for `trokky documents`

## 0.1.13

### Patch Changes

- d08c54d: Add OAuth2 consent persistence and developer tools

  OAuth2 Consent Persistence:
  - Add `getUserConsent`, `saveUserConsent`, and `revokeUserConsent` methods to engine
  - Store consents in user preferences (works with all storage adapters)
  - Update authorization route to check for existing consent and authenticate optionally
  - Update AuthorizePage to auto-approve seamlessly when consent exists
  - Skip consent screen for returning users (similar to Google OAuth behavior)

  Developer Tools (trokky dev):
  - Add hidden `trokky dev` CLI commands for core developers (requires TROKKY_DEV_MODE=1)
  - `trokky dev link` - Link local Trokky packages to a project
  - `trokky dev unlink` - Restore published package versions
  - `trokky dev rebuild` - Rebuild Trokky packages
  - `trokky dev status` - Check which packages are linked

- Updated dependencies [d08c54d]
  - @trokky/core@0.1.21

## 0.1.12

### Patch Changes

- 6eb3867: feat(auth): add OAuth2 Authorization Server for CLI login and SSO
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

- Updated dependencies [6eb3867]
  - @trokky/core@0.1.20

## 0.1.11

### Patch Changes

- 12bebc2: Fix CLI version display and GitHub Actions workflow
  - Read version dynamically from package.json instead of hardcoded value
  - Fix release workflow that was preventing automatic publishing (remove custom check job that blocked release PR merges)

## 0.1.10

### Patch Changes

- 760cb6f: Add CLI configuration system for improved developer experience

  This release introduces a new configuration system that allows developers to store and manage Trokky instance credentials, eliminating the need to pass --url and --token flags on every command.

  New features:
  - `trokky config add <name>` - Add a new instance configuration with URL and token
  - `trokky config remove <name>` - Remove an instance configuration
  - `trokky config list` - List all configured instances
  - `trokky config use <name>` - Set the default instance
  - `trokky config path` - Show the config file location

  Credential resolution priority:
  1. CLI flags (--url, --token) - highest priority
  2. Environment variables (TROKKY_URL, TROKKY_TOKEN)
  3. Configured default instance from ~/.trokky/config.yaml

  Updated commands:
  - `backup`, `restore`, `clean` - Now support --instance flag and automatic credential resolution
  - `migrate` - Now supports --from-instance and --to-instance flags

  Configuration is stored in ~/.trokky/config.yaml in a human-readable YAML format.

## 0.1.9

### Patch Changes

- 4b19257: fix(cli): Add media processing section to project generator

  The `trokky create` command now generates a complete `media` configuration section including:
  - Sharp processor configuration
  - Image variants (thumbnail, medium, large) with WebP format
  - Upload limits (50MB max file size, allowed MIME types)
  - Sharp dependency in package.json

## 0.1.8

### Patch Changes

- d76efd4: fix(cli): improve generated project configuration
  - Add captcha support (Turnstile/reCAPTCHA) with new --captcha CLI option
  - Load dotenv at the top of generated trokky.config.ts before other imports
  - Use conditional getMailConfig() function that checks TROKKY_MAIL_ENABLED
  - Make OAuth conditional (only enabled if GOOGLE_CLIENT_ID exists)
  - Make captcha conditional (only enabled if secret key env var exists)
  - Add @trokky/studio to dependencies for embedded studio
  - Add @trokky/mail-adapter-console as fallback when resend is selected
  - Fix schema type: use 'document' instead of deprecated 'collection'
  - Add complete email env vars: EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_REPLY_TO, TROKKY_MAIL_ENABLED, TROKKY_MAIL_PROVIDER
  - Add STUDIO_URL env var

## 0.1.7

### Patch Changes

- 0301795: Add `trokky create` command for project scaffolding with interactive prompts and CLI flags. Supports minimal, full, and api-only templates with configurable data/media adapters, mail providers, auth modes, and studio options. Generates README.md, .npmrc, structure.ts for Studio sidebar configuration, and detects NODE_AUTH_TOKEN for seamless authentication.
- Updated dependencies [225bbee]
  - @trokky/core@0.1.15

## 0.1.6

### Patch Changes

- c35de75: Fix reference mapping during backup restore

  **Bug Fixes:**
  - Fix ID extraction in restore to use `_id` property (API returns `_id` not `id`)
  - Fix arrays of direct references not being updated (e.g., `of: { type: "reference" }`)
  - Fix `video` field type references not being mapped (only `media` and `image` were handled)

  **Improvements:**
  - Centralize media asset types in `MEDIA_ASSET_TYPES` constant for easier extensibility
  - Support additional media-like types: `audio`, `file` (in addition to `media`, `image`, `video`)

## 0.1.5

### Patch Changes

- e3b7365: Fix nested media reference updates in array-of-objects fields

  The reference scanner now properly handles media references nested inside array items
  that are objects (e.g., testimonials with photos, gallery items). Previously, when
  scanning arrays like `testimonialCards: [{ name, photo }]`, the scanner would fail to
  detect and update the `photo` media references inside each array item.

  Changes:
  - Update scanValue() to pass object fields when array items are object types
  - Update updateValue() to correctly handle nested object fields in arrays
  - Ensures proper field resolution for deeply nested media/reference fields

  Results:
  - Testimonial photos now update correctly (27 → 30 references updated)
  - All nested media in array-of-objects fields are properly scanned
  - Fixes "Failed to load media asset" errors for nested media references

## 0.1.4

### Patch Changes

- 2c04e42: Add schema evolution handling to restore command

  The restore command now handles schema evolution issues that cause validation
  failures when restoring old backups to updated schemas. This fixes issues like
  nullable fields becoming non-nullable or old media formats being incompatible
  with new schemas.

  Changes:
  - Add sanitizeDocument() function to clean documents before restoration
  - Remove null values (schemas may have changed from nullable to non-nullable)
  - Remove empty objects (may have required nested fields in new schema)
  - Remove old media format (src-based instead of asset.\_ref)

  Results:
  - 100% restoration success rate (115/115 documents vs 112/115 before)
  - Fixes mega-menu validation failures (featuredContent.image: Invalid input)
  - Fixes reseau-page validation failures (heroSubtitle: Expected string, received null)
  - Maintains all reference updates (27 references) and media restoration (43 files)

- a65a842: Fix restore command to handle schema evolution and singleton documents

  **Schema Evolution Support:**
  - Automatically remove null values from backup data during restore
  - Prevents validation errors when schemas become stricter over time
  - Handles nested objects and arrays recursively

  **Singleton Document Fixes:**
  - Fixed singleton document restoration to use POST (create) instead of PUT
  - Properly handles creating singletons that don't exist yet
  - Falls back to PUT (update) if singleton already exists (409 conflict)

  **System Fields Cleanup:**
  - Remove all system-managed fields from backup data before restore
  - Added `_createdBy`, `_updatedBy`, `_createdByType`, `_updatedByType` to removal list
  - Prevents validation errors from system fields in backup data

  **Bug Fixes:**
  - Fixes restore failures with HTTP 400 validation errors
  - Resolves "Expected string, received null" errors
  - Resolves "Cannot PUT" errors for singleton documents
  - Enables successful restoration of backups created with older schemas

  **Technical Details:**
  - Added `sanitizeDocument()` function to recursively remove null values
  - Null values in objects are omitted entirely (schema provides defaults)
  - Null values in arrays are filtered out
  - Applied before document creation/update to ensure clean data
  - Singleton documents now use create-first approach with update fallback

  This is critical for production deployments where schemas evolve over time.

## 0.1.3

### Patch Changes

- 2bc98cf: Fix media reference updates in backup/restore with object-based field schemas

  The reference scanner was failing to update media references when restoring backups
  because it couldn't properly handle object-based field schemas (where fields are
  defined as `{ fieldName: { type: "media", ... } }` instead of an array).

  When schemas used object-based fields, `Object.values(fields)` returned field
  definitions without the field name property, causing the scanner to skip all fields
  including media references like `_thumbnail`. This resulted in restored documents
  having invalid media IDs from the backup instead of the new IDs from the restored
  media files.

  Changes:
  - Convert object-based field schemas to arrays with proper `name` property
  - Apply fix to both `scanValue()` and `updateValue()` methods
  - Fix TypeScript spread operator type safety with media fields
  - Fix Promise type signature in backup command

  Results:
  - Media references now update correctly (27 references vs 0 before)
  - Restored documents have valid media IDs pointing to new files
  - Images and media assets load properly after restoration

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
