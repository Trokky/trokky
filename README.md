# Trokky

> Modern, composable CMS for developers

Trokky is a TypeScript-native content management system designed as a developer-friendly alternative to Sanity. It provides local-first development, full type safety from schemas to frontend, and a composable architecture with a React-based admin UI.

## Packages

Trokky is a monorepo with 3 packages:

| Package | Published as | Description |
|---|---|---|
| `packages/trokky/` | `@trokky/trokky` | CMS server: engine, routes, adapters, mail, i18n, Express integration |
| `packages/studio/` | `@trokky/studio` | React admin UI and field system (25+ field types) |
| `packages/client/` | `@trokky/client` | Frontend SDK: HTTP client, query builder, type generation |

The CLI is a separate Go project at [github.com/Trokky/cli](https://github.com/Trokky/cli).

## Quick Start

```typescript
import express from 'express'
import { TrokkyExpress } from '@trokky/trokky/express'
import '@trokky/trokky/adapters/filesystem-data'
import '@trokky/trokky/adapters/filesystem-media'

const app = express()

const trokky = await TrokkyExpress.create({
  schemas: [
    {
      name: 'article',
      title: 'Article',
      type: 'document',
      fields: {
        title: { type: 'string', required: true },
        content: { type: 'richtext' },
        publishedAt: { type: 'date' }
      }
    }
  ],
  storage: {
    data: { adapter: 'filesystem-data', options: { contentDir: './content' } },
    media: { adapter: 'filesystem-media', options: { mediaDir: './media' } }
  },
  security: {
    adminUser: {
      username: process.env.TROKKY_ADMIN_EMAIL,
      password: process.env.TROKKY_ADMIN_PASSWORD
    }
  },
  studio: {
    branding: { title: 'My CMS' }
  }
})

trokky.mount(app)
app.listen(3000)
```

## Import Paths

The server package uses subpath exports for clean, targeted imports:

```typescript
// Server setup
import { TrokkyExpress } from '@trokky/trokky/express'
import '@trokky/trokky/adapters/filesystem-data'
import '@trokky/trokky/adapters/filesystem-media'

// Types
import type { BaseDocument, User } from '@trokky/trokky/types'
import type { MediaAsset } from '@trokky/trokky/types/media'

// Mail
import { MailService } from '@trokky/trokky'
import { SMTPMailAdapter } from '@trokky/trokky/mail/smtp'

// Structure
import { StructureBuilder } from '@trokky/trokky/structure'

// Client SDK (separate package)
import { TrokkyClient } from '@trokky/client'
```

## Storage Adapters

Storage is split into data (structured) and media (files), each using the adapter pattern:

| Adapter | Import | Description |
|---|---|---|
| Filesystem Data | `@trokky/trokky/adapters/filesystem-data` | File-based JSON storage, Git-friendly |
| Filesystem Media | `@trokky/trokky/adapters/filesystem-media` | Local file storage for media |
| PostgreSQL Data | `@trokky/trokky/adapters/postgres-data` | PostgreSQL for structured data |

Adapters self-register on import via `registerAdapter()`.

## Features

- **Schema-driven content modeling** with TypeScript definitions and Zod validation
- **25+ field types** including rich text, media, references, arrays, and objects
- **Split storage architecture** enabling optimal backends per concern (e.g. PostgreSQL for data, S3 for media)
- **JWT authentication** with role-based access control (admin, editor, author, viewer)
- **Multi-factor authentication** with TOTP and email OTP
- **OAuth2 authorization server** with device code flow
- **Passkey/WebAuthn** support for passwordless authentication
- **Event system** with webhooks, retry policies, and persistent storage
- **Media management** with automatic image variant generation
- **Internationalization** via i18next
- **Audit logging** for compliance and security monitoring
- **Mail service** with console, SMTP, and Resend adapters

## Configuration

Projects use `trokky.config.ts` for centralized configuration:

```typescript
// trokky.config.ts
export default {
  schemas: './schemas',
  storage: {
    data: { adapter: 'filesystem-data', options: { contentDir: './content' } },
    media: { adapter: 'filesystem-media', options: { mediaDir: './media' } }
  },
  studio: {
    branding: { title: 'My CMS' }
  },
  security: {
    adminUser: {
      username: process.env.TROKKY_ADMIN_EMAIL,
      password: process.env.TROKKY_ADMIN_PASSWORD
    }
  }
}
```

Password hashing is tuned via `security.cryptoOptions` (`adapterType`, `saltRounds`, `pbkdf2Iterations`); see [API.md](./API.md) for the versioned hash format and rehash-on-login behavior.

## Development

### Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

### Commands

```bash
npm run dev              # Start full demo (API + Studio)
npm run build            # Build all packages
npm run test             # Run all tests
npm run test:coverage    # Tests with coverage report
npm run lint             # Lint all packages
npm run type-check       # TypeScript type checking
npm run clean            # Clean build outputs
npm run format           # Format with Prettier
```

### Trying it out

There is no example app in this repository. To start a project, scaffold one with the CLI:

```bash
trokky create my-site --template blog --data filesystem
cd my-site && npm install && npm run dev
```

[trokky.dev](https://trokky.dev) walks through that build end to end, from an empty folder to
a typed page rendering content you edited in the Studio.

### Testing

Trokky uses Vitest for all packages, React Testing Library for Studio components, and Supertest for Express integration tests. Coverage target is 80%+ across the board.

```bash
cd packages/trokky && npm test       # Server tests
cd packages/studio && npm test       # Studio tests
cd packages/client && npm test       # Client tests
```

## REST API

All API endpoints are mounted at `/api` by default. Studio is served at `/studio`. The server exposes 90+ endpoints covering content CRUD, media management, authentication (JWT, OAuth, passkeys, MFA), webhooks, audit logs, and more.

See **[API.md](./API.md)** for the complete API reference.

## License

MIT
