# @trokky/studio

## 0.2.0

### Minor Changes

- Add comprehensive password reset functionality with secure UI flows:
  - Add ForgotPasswordPage for requesting password reset links
  - Add ResetPasswordPage with token verification and password strength validation
  - Add password reset links to LoginPage
  - Implement dark mode support for all password reset pages
  - Add visual password strength indicators and validation feedback
  - Support token expiration warnings and invalid token handling

## 0.1.5

### Patch Changes

- Final clean build of Studio with reference field fixes
  - Removed debug console logging
  - Confirmed working reference field search and selection

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
