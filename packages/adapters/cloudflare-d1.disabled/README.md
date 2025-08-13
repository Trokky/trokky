# @trokky/adapter-cloudflare-d1

Cloudflare D1 data storage adapter for Trokky CMS. This adapter provides SQL-based storage for documents, users, and app tokens, optimized for edge runtime on Cloudflare Workers.

## Features

- ✅ **Full DataStorageAdapter implementation**
- ✅ **Edge runtime optimized** - Works in Cloudflare Workers
- ✅ **SQL-based storage** with D1 SQLite database
- ✅ **Full-text search** support with SQLite FTS5
- ✅ **Audit logging** for compliance and debugging
- ✅ **Auto-migrations** with schema versioning
- ✅ **TypeScript native** with full type safety

## Installation

```bash
npm install @trokky/adapter-cloudflare-d1
```

## Quick Start

### 1. Database Setup

First, create and apply the database schema:

```sql
-- Run the schema.sql file in your D1 database
wrangler d1 execute your-db --file=node_modules/@trokky/adapter-cloudflare-d1/schema.sql
```

### 2. Basic Usage

```typescript
import { CloudflareD1Adapter } from '@trokky/adapter-cloudflare-d1'

// In Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataAdapter = new CloudflareD1Adapter({
      database: env.DB, // D1 binding
      enableFTS: true,
      enableAuditLog: true
    })

    // Use with Trokky
    const trokky = new TrokkyCore(config, {
      data: dataAdapter,
      media: mediaAdapter // Use with R2 adapter
    })

    // ... handle request
  }
}
```

### 3. With TrokkyExpress

```typescript
import { TrokkyExpress } from '@trokky/express'

const trokky = await TrokkyExpress.create({
  schemas: blogSchemas,
  storage: {
    data: {
      adapter: 'cloudflare-d1',
      options: {
        database: env.DB,
        enableFTS: true
      }
    },
    media: {
      adapter: 'cloudflare-r2',
      options: {
        bucket: env.R2_BUCKET
      }
    }
  }
})
```

## Configuration Options

```typescript
interface CloudflareD1AdapterConfig {
  /** D1 database binding from Cloudflare Workers environment */
  database?: D1Database
  
  /** Database name (for Wrangler local development) */
  databaseName?: string
  
  /** Table prefix for multi-tenant setups */
  tablePrefix?: string
  
  /** Enable debug logging */
  debug?: boolean
  
  /** Enable full-text search */
  enableFTS?: boolean
  
  /** Enable audit logging */
  enableAuditLog?: boolean
  
  /** Custom SQL migration queries to run on init */
  migrations?: string[]
}
```

## Database Schema

The adapter creates the following tables:

- **`documents`** - Stores all content documents with JSON data
- **`users`** - User accounts with authentication data
- **`app_tokens`** - API tokens for external integrations
- **`audit_logs`** - Optional audit trail for compliance
- **`documents_fts`** - Full-text search index (virtual table)

## Features

### Full-Text Search

Enable FTS5 full-text search for documents:

```typescript
const adapter = new CloudflareD1Adapter({
  database: env.DB,
  enableFTS: true // Enable FTS5 search
})

// Search documents
const results = await adapter.searchDocuments('article', 'search terms')
```

### Audit Logging

Track all operations for compliance:

```typescript
const adapter = new CloudflareD1Adapter({
  database: env.DB,
  enableAuditLog: true
})

// All document operations are automatically logged
```

### Multi-Tenant Support

Use table prefixes for multiple sites:

```typescript
const adapter = new CloudflareD1Adapter({
  database: env.DB,
  tablePrefix: 'site1' // Creates site1_documents, site1_users, etc.
})
```

## Deployment

### 1. Create D1 Database

```bash
wrangler d1 create trokky-db
```

### 2. Apply Schema

```bash
wrangler d1 execute trokky-db --file=schema.sql
```

### 3. Update wrangler.toml

```toml
[[d1_databases]]
binding = "DB"
database_name = "trokky-db"
database_id = "your-database-id"
```

### 4. Deploy

```bash
wrangler deploy
```

## Local Development

Use Wrangler for local D1 development:

```bash
# Start local development
wrangler dev --local --persist

# Apply migrations locally
wrangler d1 execute trokky-db --local --file=schema.sql
```

## Performance

The adapter is optimized for edge runtime:

- **Minimal dependencies** - Works in Workers restricted environment
- **Efficient queries** - Uses prepared statements and indexes
- **Batch operations** - Optimized for D1's request model
- **Connection pooling** - Managed by Cloudflare platform

## Limitations

- **D1 limits** - 25MB database size (free tier)
- **Query complexity** - Some complex joins may be slower
- **Transaction support** - Limited by D1's transaction model

## License

MIT