# @trokky/mail

## 0.1.3

### Patch Changes

- ## MFA Enforcement and Setup Improvements

  ### @trokky/core
  - Added `completeMFASetupAndLogin()` method to complete MFA setup during login flow and issue auth tokens
  - Updated `checkMFARequired()` to support role-based MFA enforcement via `mfaEnforcedRoles` setting
  - Updated `authenticateWithOAuth()` to check MFA requirements and return appropriate auth result types
  - Added `expiresAt` field to `AuthenticationSuccessResult`
  - Added `mfaEnforcedRoles` and `mfaAllowedMethods` to `SettingsConfig` interface

  ### @trokky/routes
  - MFA setup routes now accept `X-MFA-Setup-Token` header for authentication during login flow
  - Updated `initTOTPSetup`, `verifyTOTPSetup`, `initEmailOTPSetup`, `verifyEmailOTPSetup` to work with setup tokens
  - OAuth callback now properly handles MFA required and MFA setup required responses
  - Verify routes issue full auth tokens after successful MFA setup when using setup token

  ### @trokky/studio
  - Added inline MFA setup wizard on login page when MFA setup is required
  - Added backup codes display step before completing login after MFA setup
  - Added MFA indicator badge (purple shield icon) on Users page for users with MFA enabled
  - Added Reset MFA button for admins to reset other users' MFA configuration
  - Updated `apiClient.post()` to accept custom headers parameter
  - Added `MFAConfig` interface to User type

  ### @trokky/mail
  - Added MFA OTP email notification support
  - Added `mfaOtp` toggle to notification config
  - Added event listener for `user.mfa_otp_requested` events

  ### @trokky/adapter-postgres-data
  - Added support for saving/loading MFA enforcement settings (`mfaEnforcedRoles`, `mfaAllowedMethods`) in config JSONB

- Updated dependencies
  - @trokky/core@0.1.12

## 0.1.2

### Patch Changes

- 27c6b59: Add CustomTemplateRenderer for full control over email templates with variable substitution, nested properties, helper functions (formatDate, upper, lower, capitalize), and default values

## 0.1.0

### Initial Release

Complete mail layer for Trokky CMS with security-first design:

**Features:**

- Event-driven email notification system
- Multiple mail adapters: Resend, SMTP, Console (for development)
- Built-in email templates for common workflows
- Template rendering with customization support
- Password reset with secure token handling
- User creation welcome emails
- Password change notifications

**Security Features:**

- Secure callback system for sensitive data (passwords not logged in events)
- Constant-time token comparison to prevent timing attacks
- Rate limiting integration for abuse prevention

**Usage:**

```typescript
import { MailService, MailNotificationService } from '@trokky/mail'

const mailService = new MailService({
  adapter: resendAdapter,
  templateRenderer,
  defaultFrom: 'noreply@example.com',
})

const notificationService = new MailNotificationService(core.events, {
  mailService,
  baseUrl: 'https://example.com',
  core, // Required for secure callback registration
})

await notificationService.initialize()
```

### Dependencies

- @trokky/core@0.1.3
