---
title: Storage Adapters
description: Configure where and how Trokky stores content
---

Storage adapters define how Trokky persists documents and media. The adapter pattern allows you to switch storage backends without changing application code.

## Available Adapters

| Adapter | Package | Best For |
|---------|---------|----------|
| Filesystem | `@trokky/adapter-filesystem` | Development, Git workflows |
| S3 | `@trokky/adapter-s3` | AWS deployments |
| Cloudflare | `@trokky/adapter-cloudflare` | Edge deployments |

## Filesystem Adapter

The default adapter stores content as JSON files on disk.

### Installation

```bash
npm install @trokky/adapter-filesystem
```

### Configuration

```typescript
import { TrokkyExpress } from '@trokky/express';

const trokky = await TrokkyExpress.create({
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
    mediaDir: './uploads',
  },
  // ...
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contentDir` | `string` | `'./content'` | Directory for document storage |
| `mediaDir` | `string` | `'./uploads'` | Directory for media files |
| `pretty` | `boolean` | `true` | Pretty-print JSON files |

### File Structure

```
content/
├── post/
│   ├── abc123.json
│   └── def456.json
├── author/
│   └── ghi789.json
└── .cache/
    └── index.json

uploads/
├── images/
│   ├── photo-abc123.jpg
│   └── photo-abc123-thumb.jpg
└── files/
    └── document-def456.pdf
```

### Benefits

- **Git-friendly**: Version control your content
- **Simple debugging**: Inspect files directly
- **No database**: No external dependencies
- **Portable**: Copy files between environments

### Limitations

- Not suitable for high-traffic production
- No built-in replication
- File locking on concurrent writes

## S3 Adapter

For production deployments on AWS, stores documents in DynamoDB and media in S3.

### Installation

```bash
npm install @trokky/adapter-s3
```

### Configuration

```typescript
import { TrokkyExpress } from '@trokky/express';

const trokky = await TrokkyExpress.create({
  storage: {
    adapter: 's3',
    region: 'us-east-1',
    bucket: 'my-trokky-content',
    tableName: 'trokky-documents',
  },
  // ...
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `region` | `string` | Yes | AWS region |
| `bucket` | `string` | Yes | S3 bucket for media |
| `tableName` | `string` | Yes | DynamoDB table name |
| `prefix` | `string` | No | Key prefix in S3 |
| `credentials` | `object` | No | AWS credentials (uses default chain if not provided) |

### AWS Setup

1. Create an S3 bucket:

```bash
aws s3 mb s3://my-trokky-content
```

2. Create a DynamoDB table:

```bash
aws dynamodb create-table \
  --table-name trokky-documents \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

3. Configure IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-trokky-content",
        "arn:aws:s3:::my-trokky-content/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/trokky-documents"
    }
  ]
}
```

### Benefits

- Highly scalable
- Built-in redundancy
- Pay-per-use pricing
- CDN integration with CloudFront

## Cloudflare Adapter

For edge deployments using Cloudflare Workers, D1, and R2.

### Installation

```bash
npm install @trokky/adapter-cloudflare
```

### Configuration

```typescript
// In Cloudflare Worker
import { TrokkyCloudflare } from '@trokky/cloudflare';

export default {
  async fetch(request, env) {
    const trokky = TrokkyCloudflare.create({
      storage: {
        adapter: 'cloudflare',
        d1: env.DB,           // D1 binding
        r2: env.STORAGE,      // R2 binding
      },
      // ...
    });

    return trokky.handle(request);
  },
};
```

### Wrangler Configuration

```toml
# wrangler.toml
name = "my-trokky-cms"

[[d1_databases]]
binding = "DB"
database_name = "trokky"
database_id = "xxx-xxx-xxx"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "trokky-media"
```

### D1 Schema

Run migrations to set up the database:

```sql
-- migrations/001_init.sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_documents_type ON documents(type);
```

### Benefits

- Global edge deployment
- Low latency worldwide
- Integrated with Cloudflare ecosystem
- Generous free tier

## Custom Adapters

You can create custom adapters by implementing the `StorageAdapter` interface:

```typescript
import { StorageAdapter, Document, ListOptions } from '@trokky/core';

export class CustomAdapter implements StorageAdapter {
  async createDocument(collection: string, data: any): Promise<Document> {
    // Implementation
  }

  async getDocument(collection: string, id: string): Promise<Document | null> {
    // Implementation
  }

  async updateDocument(collection: string, id: string, data: any): Promise<Document> {
    // Implementation
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    // Implementation
  }

  async listDocuments(collection: string, options?: ListOptions): Promise<Document[]> {
    // Implementation
  }

  // Media methods
  async uploadMedia(file: Buffer, metadata: MediaMetadata): Promise<MediaAsset> {
    // Implementation
  }

  async getMedia(id: string): Promise<MediaAsset | null> {
    // Implementation
  }

  async deleteMedia(id: string): Promise<void> {
    // Implementation
  }
}
```

### Using Custom Adapters

```typescript
import { TrokkyExpress } from '@trokky/express';
import { CustomAdapter } from './custom-adapter.js';

const trokky = await TrokkyExpress.create({
  storage: new CustomAdapter({
    // Custom options
  }),
  // ...
});
```

## Switching Adapters

One of Trokky's strengths is easy adapter switching. For example, use filesystem in development and S3 in production:

```typescript
import { TrokkyExpress } from '@trokky/express';

const isDev = process.env.NODE_ENV !== 'production';

const trokky = await TrokkyExpress.create({
  storage: isDev
    ? {
        adapter: 'filesystem',
        contentDir: './content',
      }
    : {
        adapter: 's3',
        region: process.env.AWS_REGION,
        bucket: process.env.S3_BUCKET,
        tableName: process.env.DYNAMODB_TABLE,
      },
  // ...
});
```

## Data Migration

To migrate data between adapters, use the CLI:

```bash
# Export from filesystem
npx trokky export --adapter filesystem --dir ./content --output ./backup.json

# Import to S3
npx trokky import --adapter s3 --input ./backup.json
```

Or programmatically:

```typescript
import { FilesystemAdapter } from '@trokky/adapter-filesystem';
import { S3Adapter } from '@trokky/adapter-s3';

const source = new FilesystemAdapter({ contentDir: './content' });
const target = new S3Adapter({ /* config */ });

// Get all documents from source
const schemas = ['post', 'author', 'category'];
for (const schema of schemas) {
  const docs = await source.listDocuments(schema);
  for (const doc of docs) {
    await target.createDocument(schema, doc);
  }
}
```

## Next Steps

- [Authentication](/guides/authentication/) - Set up users and permissions
- [Media Handling](/guides/media/) - Configure media processing
- [Deployment](/guides/deployment/) - Deploy to production
