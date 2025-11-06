# @trokky/studio

## 0.1.4

### Patch Changes

- Rebuild Studio with @trokky/fields v0.1.2 fix
  - Ensures reference field document ID fix is bundled in Studio assets
  - Previous build was missing the \_id field mapping fix

## 0.1.3

### Patch Changes

- Update @trokky/fields dependency to v0.1.2 with reference field fix

## 2.1.0

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
