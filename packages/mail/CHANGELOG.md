# @trokky/mail

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
