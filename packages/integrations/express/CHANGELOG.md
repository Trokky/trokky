# @trokky/express

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
