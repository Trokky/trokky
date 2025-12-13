# @trokky/mail-adapter-smtp

## 0.1.4

### Patch Changes

- fd7f1d8: refactor(types): Consolidate shared types into @trokky/types

  Centralizes type definitions to eliminate duplication across packages.

  Slug Types:
  - Add `slug.ts` with consolidated slug types (SlugifyOptions, SlugFieldConfig, SlugFieldValue, SlugFieldOptions)
  - Add subpath export `@trokky/types/slug` for direct imports
  - Update @trokky/routes and @trokky/fields to import from @trokky/types

  Field System Types:
  - Add `field-system.ts` with 14 core field system types:
    - ConditionalOperator, ConditionalConfig (conditional visibility)
    - ValidationResult, BaseValidation, ValidationState (validation)
    - FieldCategory, BaseFieldOptions, BaseFieldDefinition, BaseFieldValue (field definitions)
    - DocumentContext (document context)
    - FieldPluginSource, BaseFieldPlugin, BaseRegisteredFieldPlugin (plugin types without React deps)
  - Add subpath export `@trokky/types/field-system` for direct imports
  - Update @trokky/fields to import and re-export from @trokky/types

  Other Changes:
  - Add @trokky/types as dependency to @trokky/routes
  - Fix broken test scripts in mail packages (removed non-functional jest commands)
  - Remove outdated package filters from root package.json test/lint scripts

  This refactoring improves type consistency across the Trokky ecosystem by maintaining a single source of truth for shared types.

- Updated dependencies [3f58a2a]
- Updated dependencies [fd7f1d8]
  - @trokky/core@2.0.4
  - @trokky/mail@0.1.4

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
    pass: process.env.SMTP_PASS,
  },
})
```

### Dependencies

- @trokky/core@0.1.3
- @trokky/mail@0.1.0
- nodemailer@^6.9.0
