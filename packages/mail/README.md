# @trokky/mail

Framework-agnostic mail layer for Trokky CMS with adapter pattern and professional email templates.

## Features

- **Adapter Pattern**: Switch between email providers without changing code
- **Built-in Templates**: 8 professional, responsive email templates
- **Type-Safe**: Full TypeScript support
- **Framework Agnostic**: Works with Express, Next.js, Cloudflare Workers, etc.
- **Event-Driven**: Automatic email notifications via event system
- **Testable**: Console adapter for development

## Installation

```bash
npm install @trokky/mail
```

### Install an adapter

```bash
# For development
npm install @trokky/mail-adapter-console

# For production
npm install @trokky/mail-adapter-resend
# or
npm install @trokky/mail-adapter-smtp nodemailer
```

## Quick Start

```typescript
import { MailService, BuiltInTemplateRenderer } from '@trokky/mail'
import { ConsoleMailAdapter } from '@trokky/mail-adapter-console'
// or import { ResendMailAdapter } from '@trokky/mail-adapter-resend'

// 1. Create mail adapter
const mailAdapter = new ConsoleMailAdapter({
  format: 'detailed', // or 'simple', 'json'
})

// 2. Create template renderer
const templateRenderer = new BuiltInTemplateRenderer({
  brandName: 'My CMS',
  brandColor: '#667eea',
  supportEmail: 'support@example.com',
  baseUrl: 'https://example.com',
})

// 3. Create mail service
const mailService = new MailService({
  adapter: mailAdapter,
  templateRenderer,
  defaultFrom: 'noreply@example.com',
  defaultFromName: 'My CMS',
})

// 4. Initialize
await mailService.initialize()

// 5. Send emails
await mailService.sendPasswordReset({
  user: {
    id: '123',
    email: 'user@example.com',
    firstName: 'John',
    // ... other user fields
  },
  resetToken: 'abc123',
  resetUrl: 'https://example.com/reset?token=abc123',
  expiryMinutes: 60,
})
```

## Adapters

### Console Adapter (Development)

Logs emails to console instead of sending them.

```typescript
import { ConsoleMailAdapter } from '@trokky/mail-adapter-console'

const adapter = new ConsoleMailAdapter({
  format: 'detailed', // 'simple' | 'detailed' | 'json'
  includeHtml: false, // Include HTML in logs
})
```

### Resend Adapter (Production)

```typescript
import { ResendMailAdapter } from '@trokky/mail-adapter-resend'

const adapter = new ResendMailAdapter({
  apiKey: process.env.RESEND_API_KEY!,
  from: 'noreply@example.com',
  fromName: 'My CMS',
})
```

### SMTP Adapter (Gmail, Outlook, etc.)

```typescript
import { SMTPMailAdapter } from '@trokky/mail-adapter-smtp'

const adapter = new SMTPMailAdapter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
  pool: true, // Use connection pooling
  maxConnections: 5,
})
```

## Built-in Templates

All templates include HTML and plain text versions:

### 1. Password Reset

```typescript
await mailService.sendPasswordReset({
  user,
  resetToken: 'abc123',
  resetUrl: 'https://example.com/reset?token=abc123',
  expiryMinutes: 60,
})
```

### 2. Password Changed

```typescript
await mailService.sendPasswordChanged({
  user,
  changedAt: new Date(),
})
```

### 3. OTP Verification

```typescript
await mailService.sendOTP({
  to: 'user@example.com',
  otpCode: '123456',
  expiryMinutes: 10,
  purpose: 'account verification',
})
```

### 4. Security Alert

```typescript
await mailService.sendSecurityAlert({
  user,
  alertType: 'Unusual login detected',
  details: 'Login from new location: San Francisco, CA',
  timestamp: new Date(),
  actionRequired: 'Please verify this was you',
})
```

### 5. User Invitation

```typescript
await mailService.sendUserInvite({
  to: 'newuser@example.com',
  inviterName: 'John Doe',
  inviteUrl: 'https://example.com/invite?token=xyz',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
})
```

### 6. Welcome Email

```typescript
await mailService.sendWelcome({
  user,
})
```

### 7. Account Approved

```typescript
await mailService.sendAccountApproved({
  user,
})
```

### 8. Account Rejected

```typescript
await mailService.sendAccountRejected({
  to: 'user@example.com',
  reason: 'Invalid registration information',
  rejectedAt: new Date(),
})
```

## Event-Driven Notifications

Integrate with Trokky's event system for automatic emails:

```typescript
import { MailNotificationService } from '@trokky/mail'

const notificationService = new MailNotificationService(eventBus, {
  mailService,
  baseUrl: 'https://example.com',
  enabled: {
    passwordReset: true,
    passwordChanged: true,
    userCreated: true,
    userInvited: true,
    securityAlerts: true,
  },
})

await notificationService.initialize()
```

Now emails will be sent automatically when events are emitted:

```typescript
// Emitting this event...
await eventBus.emit({
  type: 'user.password_reset_requested',
  data: { user, resetToken },
})

// ...will automatically send password reset email
```

## Custom Templates

Use the template renderer directly for custom emails:

```typescript
const template = templateRenderer.render('password-reset', {
  firstName: 'John',
  resetUrl: 'https://example.com/reset?token=abc123',
  expiryMinutes: 60,
})

await mailService.send({
  to: 'user@example.com',
  subject: template.subject,
  html: template.html,
  text: template.text,
})
```

## Integration with Trokky

In your `trokky.config.ts`:

```typescript
import { ConsoleMailAdapter } from '@trokky/mail-adapter-console'
import { BuiltInTemplateRenderer, MailService } from '@trokky/mail'

export default {
  // ... other config ...

  mail: {
    adapter: new ConsoleMailAdapter({ format: 'detailed' }),
    templates: {
      brandName: 'My CMS',
      brandColor: '#667eea',
      supportEmail: 'support@example.com',
      baseUrl: 'https://example.com',
    },
    from: 'noreply@example.com',
    fromName: 'My CMS',
    notifications: {
      passwordReset: true,
      passwordChanged: true,
      userCreated: true,
      userInvited: true,
      securityAlerts: true,
    },
  },
}
```

## API Routes

The mail layer adds password reset routes:

- `POST /api/auth/request-reset` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-reset-token` - Verify token validity

### Request Password Reset

```bash
curl -X POST http://localhost:3000/api/auth/request-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Reset Password

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123xyz...",
    "newPassword": "NewSecurePassword123!"
  }'
```

## License

MIT
