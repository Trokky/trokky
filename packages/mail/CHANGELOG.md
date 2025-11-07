# @trokky/mail

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @trokky/core@0.1.3
