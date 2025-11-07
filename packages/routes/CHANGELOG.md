# @trokky/routes

## 0.1.4

### Patch Changes

- Fix critical security vulnerabilities in password reset and mail system

  **Security Fixes:**
  1. **Removed plain text passwords from event system** - Passwords are no longer logged in events, preventing exposure in logs and event storage
  2. **Constant-time token comparison** - Password reset tokens now use constant-time comparison to prevent timing attacks
  3. **Unified password validation** - Reset flow now enforces same strong password requirements as change password
  4. **Rate limiting on password reset** - Added rate limiting to prevent abuse, spam, and enumeration attacks

  **New Features:**
  - `TrokkyCore.onUserCreatedWithPassword()` - Secure callback for sending temporary passwords without logging
  - `TrokkyCore.checkRateLimit()` - Public method for routes to use rate limiter

  **Breaking Changes:**
  - `MailNotificationService` now requires `core` parameter in config for secure callback registration

  **Migration Guide:**

  Update your MailNotificationService initialization:

  ```typescript
  // Before:
  new MailNotificationService(eventBus, {
    mailService,
    baseUrl: 'https://example.com',
    // ...
  })

  // After:
  new MailNotificationService(core.events, {
    mailService,
    baseUrl: 'https://example.com',
    core, // Required for secure callback registration
    // ...
  })
  ```

- Updated dependencies
  - @trokky/core@0.1.3

## 0.1.3

### Patch Changes

- Add search parameter support to listDocuments endpoint
  - Added search query parameter to GET /collections/:collection endpoint
  - Implements client-side text filtering across common fields (name, title, description, etc.)
  - Enables reference field search functionality in Studio

## 0.1.2

### Patch Changes

- Remove restrictive slug validation in checkSlugUniqueness endpoint

  The slug uniqueness check was using a rigid regex that rejected valid slugs,
  causing backup/restore failures. Now only validates non-empty slugs, allowing
  the schema field definition to handle format validation.

## 0.1.1

### Patch Changes

- Add backup and restore endpoints with pre-flight checks and singleton support

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
