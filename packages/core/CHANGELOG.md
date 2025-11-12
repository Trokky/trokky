# @trokky/core

## 0.1.4

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

## 0.1.3

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
