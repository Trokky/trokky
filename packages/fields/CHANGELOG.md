# @trokky/fields

## 0.1.2

### Patch Changes

- Fix reference field search and selection - use \_id instead of id for document IDs
  - Fixed search filtering to correctly map document.\_id to result.id
  - Fixed selection handling to properly identify selected references
  - Added backward compatibility by using doc.\_id || doc.id fallback pattern

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
