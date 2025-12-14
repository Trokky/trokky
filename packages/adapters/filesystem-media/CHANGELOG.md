# @trokky/adapter-filesystem-media

## 2.0.1

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

## 2.0.0

### Patch Changes

- Updated dependencies [4351835]
  - @trokky/core@2.0.0

## 1.0.0

### Patch Changes

- Updated dependencies [3bbba91]
  - @trokky/core@1.0.0

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
