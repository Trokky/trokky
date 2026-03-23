# Trokky

> Modern, composable CMS for developers

Trokky is a TypeScript-native content management system designed as a developer-friendly alternative to Sanity. It provides local-first development, full type safety from schemas to frontend, and a composable architecture with a React-based admin UI.

## Packages

Trokky is a monorepo with 3 packages:

| Package | Published as | Description |
|---|---|---|
| `packages/trokky/` | `trokky` | CMS server: engine, routes, adapters, mail, i18n, Express integration |
| `packages/studio/` | `@trokky/studio` | React admin UI and field system (25+ field types) |
| `packages/client/` | `@trokky/client` | Frontend SDK: HTTP client, query builder, type generation |

The CLI is a separate Go project at [github.com/Trokky/cli](https://github.com/Trokky/cli).

## Quick Start

```typescript
import express from 'express'
import { TrokkyExpress } from 'trokky/express'
import 'trokky/adapters/filesystem-data'
import 'trokky/adapters/filesystem-media'

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
import { TrokkyExpress } from 'trokky/express'
import 'trokky/adapters/filesystem-data'
import 'trokky/adapters/filesystem-media'

// Types
import type { BaseDocument, User } from 'trokky/types'
import type { MediaAsset } from 'trokky/types/media'

// Mail
import { MailService } from 'trokky'
import { SMTPMailAdapter } from 'trokky/mail/smtp'

// Structure
import { StructureBuilder } from 'trokky/structure'

// Client SDK (separate package)
import { TrokkyClient } from '@trokky/client'
```

## Storage Adapters

Storage is split into data (structured) and media (files), each using the adapter pattern:

| Adapter | Import | Description |
|---|---|---|
| Filesystem Data | `trokky/adapters/filesystem-data` | File-based JSON storage, Git-friendly |
| Filesystem Media | `trokky/adapters/filesystem-media` | Local file storage for media |
| PostgreSQL Data | `trokky/adapters/postgres-data` | PostgreSQL for structured data |

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

### Running the Demo

```bash
cd examples/demo
npm run dev              # Start API server
npm run dev:full         # Start API + Studio dev server
```

### Testing

Trokky uses Vitest for all packages, React Testing Library for Studio components, and Supertest for Express integration tests. Coverage target is 80%+ across the board.

```bash
cd packages/trokky && npm test       # Server tests
cd packages/studio && npm test       # Studio tests
cd packages/client && npm test       # Client tests
```

## REST API

All API endpoints are mounted at `/api` by default. Studio is served at `/studio`.

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `POST /api/auth/refresh` - Refresh token

### Content
- `GET /api/collections` - List collections
- `GET /api/collections/:collection` - List documents (supports `limit`, `offset`, `filter`, `sort`)
- `POST /api/collections/:collection` - Create document
- `GET /api/collections/:collection/:id` - Get document
- `PUT /api/collections/:collection/:id` - Update document
- `DELETE /api/collections/:collection/:id` - Delete document

### Media
- `GET /api/media` - List media
- `POST /api/media/upload` - Upload files (multipart/form-data)
- `GET /api/media/:id` - Get media info
- `GET /api/media/:id/file` - Serve file
- `GET /api/media/:id/variants/:variant` - Serve variant
- `DELETE /api/media/:id` - Delete media

### Users (Admin)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Webhooks (Admin)
- `GET /api/webhooks` - List webhooks
- `POST /api/webhooks` - Create webhook
- `PUT /api/webhooks/:id` - Update webhook
- `DELETE /api/webhooks/:id` - Delete webhook
- `POST /api/webhooks/:id/test` - Test webhook

### Other
- `GET /api/health` - Health check (public)
- `GET /api/schemas/:name` - Get schema definition
- `GET /api/config/structure` - Studio navigation structure
- `GET /api/slugs/check-unique` - Check slug uniqueness
- `GET /api/audit-logs/documents/:id` - Document audit trail

All endpoints return a standard `{ success, data?, error?, meta? }` response format.

## License

MIT
