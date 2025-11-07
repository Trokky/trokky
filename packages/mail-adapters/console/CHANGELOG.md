# @trokky/mail-adapter-console

## 0.1.0

### Initial Release

Console mail adapter for Trokky CMS development and testing:

**Features:**
- Logs emails to console instead of sending them
- Full support for MailAdapter interface
- Perfect for local development and testing
- No external dependencies or API keys required

**Usage:**

```typescript
import { ConsoleMailAdapter } from '@trokky/mail-adapter-console'

const adapter = new ConsoleMailAdapter({
  logLevel: 'full' // 'full', 'summary', or 'minimal'
})
```

### Dependencies

- @trokky/core@0.1.3
- @trokky/mail@0.1.0
