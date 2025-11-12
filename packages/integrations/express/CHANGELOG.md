# @trokky/express

## 0.1.3

### Patch Changes

- 9a7f248: Replace direct console statements with proper logger system

  All console.log, console.warn, and console.error statements have been replaced with the unified logger system for better log control and consistency.

  Changes:
  - @trokky/core: Added loggers to media processors (sharp, cloudflare-transform-store, workers-images)
  - @trokky/routes: Replaced console statements in slug validation and auth endpoints with logger calls
  - @trokky/express: Added loggers to adapter and media-rewrite-middleware
  - @trokky/adapter-postgres-data: Changed connection pool logs from info to debug level

  Benefits:
  - Consistent logging format across all packages
  - Logs can be controlled via log levels (debug, info, warn, error)
  - Reduced log noise in production environments

- Updated dependencies [9a7f248]
  - @trokky/core@0.1.4
  - @trokky/routes@0.1.5

## 0.1.2

### Patch Changes

- Republish with media variants fix (v0.1.1 was published without the fix)

  Ensures global studio config includes media.variants even when studio.enabled=false

## 0.1.1

### Patch Changes

- Fix studio config to include media variants when studio.enabled is false

  **Bug Fix:**
  - Global studio config now properly includes media.variants configuration even when studio UI is disabled
  - This enables standalone Studio services and CLI restore commands to access variant configuration
  - Fixes "Media Variant Mismatch" errors during backup restoration

  **Technical Details:**
  - The `TrokkyExpress.create()` method now sets `(global as any).__TROKKY_STUDIO_CONFIG__.media.variants` from the media config
  - This ensures the `/api/config/studio` endpoint returns variants regardless of studio.enabled setting
  - Critical for deployments using separate Studio services (e.g., https://studio.example.com)

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
