# @trokky/mail-adapter-smtp

## 0.1.0

### Initial Release

SMTP mail adapter for Trokky CMS with universal email server support:

**Features:**
- Full SMTP protocol support via Nodemailer
- Compatible with any SMTP server
- TLS/SSL support for secure connections
- Connection pooling for better performance
- Support for authentication methods

**Usage:**

```typescript
import { SMTPMailAdapter } from '@trokky/mail-adapter-smtp'

const adapter = new SMTPMailAdapter({
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})
```

### Dependencies

- @trokky/core@0.1.3
- @trokky/mail@0.1.0
- nodemailer@^6.9.0
