# @trokky/core

## 0.1.2

### Patch Changes

- Remove overly restrictive slug validation regex

  The slug validator was using a rigid regex pattern that rejected valid slugs with
  forward slashes, even when the schema had `allowSlashes: true` configured. This
  caused backup/restore failures and prevented users from using hierarchical slugs
  like "blog/posts/my-article".

  Changes:
  - Removed regex validation that ignored schema-level slug options
  - Now only validates basic constraints (non-empty, length limits)
  - Respects schema configuration for allowSlashes, preserveCase, allowedChars
  - Fixes backup/restore compatibility with hierarchical slugs

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
