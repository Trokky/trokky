---
title: "Cloudflare Adapter"
description: Edge storage using Cloudflare D1 and R2
---

`@trokky/adapter-cloudflare` provides storage using Cloudflare D1 (SQLite database) and R2 (object storage), enabling edge-native CMS deployments.

## Installation

```bash
npm install @trokky/adapter-cloudflare
```

## Usage

```typescript
// In Cloudflare Worker
import { CloudflareAdapter } from '@trokky/adapter-cloudflare';

export default {
  async fetch(request: Request, env: Env) {
    const storage = new CloudflareAdapter({
      d1: env.DB,
      r2: env.STORAGE,
    });

    // Use with TrokkyCloudflare
    const trokky = TrokkyCloudflare.create({
      storage,
      // ...
    });

    return trokky.handle(request);
  },
};
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `d1` | `D1Database` | Yes | D1 database binding |
| `r2` | `R2Bucket` | Yes | R2 bucket binding |
| `mediaPrefix` | `string` | No | Prefix for R2 media keys |

## Setup

### 1. Create D1 Database

```bash
wrangler d1 create trokky-db
```

### 2. Create R2 Bucket

```bash
wrangler r2 bucket create trokky-media
```

### 3. Configure wrangler.toml

```toml
name = "trokky-cms"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "trokky-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "trokky-media"
```

### 4. Run Migrations

Create migration file:

```sql
-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
```

Apply migration:

```bash
wrangler d1 migrations apply trokky-db
```

## Complete Worker Example

```typescript
// src/index.ts
import { TrokkyCloudflare } from '@trokky/cloudflare';
import { CloudflareAdapter } from '@trokky/adapter-cloudflare';

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  JWT_SECRET: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

const schemas = [
  {
    name: 'post',
    title: 'Post',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'richtext' },
    ],
  },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const storage = new CloudflareAdapter({
      d1: env.DB,
      r2: env.STORAGE,
    });

    const trokky = TrokkyCloudflare.create({
      schemas,
      storage,
      security: {
        jwtSecret: env.JWT_SECRET,
        adminUser: {
          username: env.ADMIN_USERNAME,
          password: env.ADMIN_PASSWORD,
        },
      },
    });

    return trokky.handle(request);
  },
};
```

## API Reference

### Constructor

```typescript
new CloudflareAdapter(options: CloudflareAdapterOptions)
```

### Methods

All standard `StorageAdapter` methods are implemented:

```typescript
// Documents
createDocument(collection: string, data: any): Promise<Document>
getDocument(collection: string, id: string): Promise<Document | null>
updateDocument(collection: string, id: string, data: any): Promise<Document>
deleteDocument(collection: string, id: string): Promise<void>
listDocuments(collection: string, options?: ListOptions): Promise<Document[]>

// Media
uploadMedia(file: ArrayBuffer, metadata: MediaMetadata): Promise<MediaAsset>
getMedia(id: string): Promise<MediaAsset | null>
deleteMedia(id: string): Promise<void>
listMedia(options?: ListOptions): Promise<MediaAsset[]>
```

## Media Handling

### Upload

Media files are stored in R2:

```typescript
const asset = await storage.uploadMedia(arrayBuffer, {
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  alt: 'Photo description',
});

// Returns
{
  _id: 'media-abc123',
  filename: 'photo.jpg',
  url: '/media/photo-abc123.jpg',
  // ...
}
```

### Public URL

Configure custom domain for R2:

```typescript
const storage = new CloudflareAdapter({
  d1: env.DB,
  r2: env.STORAGE,
  publicUrl: 'https://media.example.com',
});
```

### R2 Public Access

Enable public access for your R2 bucket:

1. Go to R2 > Your Bucket > Settings
2. Enable "Public Access"
3. Configure custom domain (optional)

## D1 Schema

### Documents Table

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,           -- JSON string
  created_at TEXT NOT NULL,     -- ISO 8601
  updated_at TEXT NOT NULL      -- ISO 8601
);
```

### Media Table

```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt TEXT,
  metadata TEXT,                -- JSON string
  r2_key TEXT NOT NULL,         -- R2 object key
  created_at TEXT NOT NULL
);
```

### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT
);
```

## Performance

### D1 Considerations

- D1 is SQLite-based with read replicas at the edge
- Writes go to a primary location
- Reads are fast from edge replicas
- Use indexes for frequently queried fields

### R2 Considerations

- R2 provides global object storage
- No egress fees
- Use R2 public access or custom domain for media URLs
- Consider CDN caching for frequently accessed media

### Optimization Tips

1. **Index frequently filtered fields** in D1
2. **Use pagination** for large result sets
3. **Cache schema queries** at the edge
4. **Enable R2 caching** headers

## Local Development

### Wrangler Dev

```bash
wrangler dev
```

This starts a local server with:
- Local D1 database
- Local R2 bucket simulation

### Local D1 Data

```bash
# Execute SQL locally
wrangler d1 execute trokky-db --local --command "SELECT * FROM documents"

# Apply migrations locally
wrangler d1 migrations apply trokky-db --local
```

## Deployment

### Deploy Worker

```bash
wrangler deploy
```

### Environment Variables

Set secrets:

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_PASSWORD
```

Or use `wrangler.toml`:

```toml
[vars]
ADMIN_USERNAME = "admin"

# Don't put secrets in wrangler.toml!
```

## Migration from Filesystem

```typescript
import { FilesystemAdapter } from '@trokky/adapter-filesystem';
import { CloudflareAdapter } from '@trokky/adapter-cloudflare';

async function migrate(env: Env) {
  const source = new FilesystemAdapter({ contentDir: './content' });
  const target = new CloudflareAdapter({ d1: env.DB, r2: env.STORAGE });

  const schemas = ['post', 'author', 'category'];

  for (const schema of schemas) {
    const docs = await source.listDocuments(schema);
    for (const doc of docs) {
      await target.createDocument(schema, doc);
    }
  }

  // Migrate media
  const media = await source.listMedia();
  for (const asset of media) {
    const file = await fs.readFile(`./uploads/${asset.filename}`);
    await target.uploadMedia(file, asset);
  }
}
```

## Troubleshooting

### D1 Query Errors

```typescript
// Check D1 query
const result = await env.DB.prepare(
  'SELECT * FROM documents WHERE type = ?'
).bind('post').all();
console.log(result);
```

### R2 Access Issues

```typescript
// Check R2 object
const object = await env.STORAGE.get('media/photo-abc123.jpg');
if (!object) {
  console.log('Object not found');
}
```

### Migration Issues

```bash
# Check migration status
wrangler d1 migrations list trokky-db
```

## Next Steps

- [Filesystem Adapter](/packages/adapters/filesystem/) - Local development
- [S3 Adapter](/packages/adapters/s3/) - AWS storage
- [Deployment Guide](/guides/deployment/) - Production deployment
