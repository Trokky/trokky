# @trokky/mail-adapter-resend

## 0.1.0

### Initial Release

Resend mail adapter for Trokky CMS production email delivery:

**Features:**
- Full integration with Resend API
- Support for all MailAdapter features
- Production-ready email sending
- Built-in error handling and retries

**Usage:**

```typescript
import { ResendMailAdapter } from '@trokky/mail-adapter-resend'

const adapter = new ResendMailAdapter({
  apiKey: process.env.RESEND_API_KEY
})
```

### Dependencies

- @trokky/core@0.1.3
- @trokky/mail@0.1.0
- resend@^6.4.0
