---
title: "@trokky/express"
description: Express.js integration for Trokky
---

`@trokky/express` provides a complete Express.js integration for Trokky, including API routes, Studio serving, and middleware.

## Installation

```bash
npm install @trokky/express @trokky/core @trokky/adapter-filesystem
```

## Quick Start

```typescript
import express from 'express';
import { TrokkyExpress } from '@trokky/express';

const app = express();

const trokky = await TrokkyExpress.create({
  schemas: [
    {
      name: 'post',
      title: 'Post',
      fields: [
        { name: 'title', type: 'string', required: true },
      ],
    },
  ],
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
  },
  security: {
    adminUser: {
      username: 'admin',
      password: 'demo123',
    },
  },
});

trokky.mount(app);

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  console.log('Studio at http://localhost:3000/studio');
});
```

## Configuration

### Full Configuration

```typescript
const trokky = await TrokkyExpress.create({
  // Content schemas
  schemas: [...],

  // Storage configuration
  storage: {
    adapter: 'filesystem',  // or 's3', 'cloudflare'
    contentDir: './content',
    mediaDir: './uploads',
  },

  // Security settings
  security: {
    jwtSecret: process.env.JWT_SECRET,
    adminUser: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
    tokenExpiry: '7d',
  },

  // Server settings
  server: {
    basePath: '/api',       // API base path
    cors: {
      origin: 'http://localhost:5173',
      credentials: true,
    },
    bodyLimit: '10mb',
    trustProxy: true,
  },

  // Media settings
  media: {
    uploadDir: './uploads',
    processor: 'sharp',
    maxFileSize: 10 * 1024 * 1024,
    variants: [
      { name: 'thumb', width: 200, height: 200, fit: 'cover' },
      { name: 'medium', width: 800 },
    ],
  },

  // Studio settings
  studio: {
    enabled: true,
    basePath: '/studio',
    branding: {
      title: 'My CMS',
    },
  },
});
```

## API Reference

### TrokkyExpress.create()

Creates a new Trokky Express instance.

```typescript
const trokky = await TrokkyExpress.create(options: TrokkyExpressOptions);
```

Returns a `TrokkyExpress` instance with methods for mounting and middleware.

### trokky.mount()

Mounts all Trokky routes to an Express app.

```typescript
trokky.mount(app);
```

This mounts:
- API routes at `/api/*`
- Studio at `/studio/*` (if enabled)
- Media serving at `/media/*`

### trokky.router()

Returns an Express router with all Trokky routes.

```typescript
const router = trokky.router();
app.use('/cms', router);  // Mount at custom path
```

### trokky.core

Access the underlying `TrokkyCore` instance:

```typescript
const schemas = trokky.core.getSchemas();
const doc = await trokky.core.documents.get('post', 'id');
```

## Middleware

### Authentication Middleware

```typescript
import { requireAuth, requireRole } from '@trokky/express';

// Require any authenticated user
app.get('/api/protected', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Require specific role
app.get('/api/admin', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only' });
});

// Require one of multiple roles
app.get('/api/editors', requireRole(['admin', 'editor']), (req, res) => {
  res.json({ message: 'Editor access' });
});
```

### CORS Middleware

CORS is automatically configured, but you can customize:

```typescript
server: {
  cors: {
    origin: ['http://localhost:3000', 'https://app.example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    maxAge: 86400,
  },
}
```

### Body Parser

Body parsing is included. Configure limits:

```typescript
server: {
  bodyLimit: '10mb',
}
```

## Custom Routes

Add custom routes alongside Trokky:

```typescript
const app = express();

// Custom routes before mounting Trokky
app.get('/api/custom', (req, res) => {
  res.json({ custom: true });
});

// Mount Trokky
trokky.mount(app);

// Custom routes after (catches any not handled by Trokky)
app.get('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

## Webhooks

Trigger webhooks on content changes:

```typescript
const trokky = await TrokkyExpress.create({
  // ...
  webhooks: {
    endpoints: [
      {
        url: 'https://example.com/webhook',
        events: ['document:created', 'document:updated'],
        secret: process.env.WEBHOOK_SECRET,
      },
    ],
  },
});
```

## Error Handling

Trokky includes error handling middleware:

```typescript
// Errors are automatically caught and formatted
// Custom error handler (add after trokky.mount)
app.use((err, req, res, next) => {
  console.error('Custom error handler:', err);

  // Forward to Trokky's error handler
  next(err);
});
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "title", "message": "Required" }
    ]
  }
}
```

## Static File Serving

### Media Files

Media is served automatically:

```
GET /media/image-123.jpg
GET /media/image-123-thumb.jpg
```

### Custom Static Files

```typescript
app.use('/static', express.static('public'));
```

## Development vs Production

### Development

```typescript
const trokky = await TrokkyExpress.create({
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
  },
  server: {
    cors: {
      origin: 'http://localhost:5173',  // Vite dev server
      credentials: true,
    },
  },
  studio: {
    enabled: true,
    dev: {
      hotReload: true,
    },
  },
});
```

### Production

```typescript
const trokky = await TrokkyExpress.create({
  storage: {
    adapter: 's3',
    region: process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET,
    tableName: process.env.DYNAMODB_TABLE,
  },
  security: {
    jwtSecret: process.env.JWT_SECRET,
    adminUser: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  },
  server: {
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    },
    trustProxy: true,
  },
  studio: {
    enabled: true,
  },
});

// Trust proxy headers
app.set('trust proxy', 1);
```

## TypeScript

Full TypeScript support:

```typescript
import { TrokkyExpress, TrokkyExpressOptions } from '@trokky/express';
import type { Request, Response } from 'express';

const options: TrokkyExpressOptions = {
  schemas: [...],
  storage: { ... },
};

const trokky = await TrokkyExpress.create(options);

// Request includes user
app.get('/api/me', requireAuth(), (req: Request, res: Response) => {
  const user = req.user;  // Typed as User | undefined
  res.json(user);
});
```

## Examples

### Complete Server

```typescript
import express from 'express';
import { TrokkyExpress } from '@trokky/express';
import { schemas } from './schemas.js';

const app = express();

// Trust proxy for HTTPS
app.set('trust proxy', 1);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize Trokky
const trokky = await TrokkyExpress.create({
  schemas,
  storage: {
    adapter: process.env.NODE_ENV === 'production' ? 's3' : 'filesystem',
    contentDir: './content',
    // S3 config for production
    ...(process.env.NODE_ENV === 'production' && {
      region: process.env.AWS_REGION,
      bucket: process.env.S3_BUCKET,
      tableName: process.env.DYNAMODB_TABLE,
    }),
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    adminUser: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'demo123',
    },
  },
  server: {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  },
  studio: {
    enabled: true,
    branding: {
      title: 'My CMS',
    },
  },
});

// Mount Trokky
trokky.mount(app);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Studio: http://localhost:${PORT}/studio`);
  console.log(`API: http://localhost:${PORT}/api`);
});
```

## Next Steps

- [@trokky/nextjs](/packages/nextjs/) - Next.js integration
- [Deployment Guide](/guides/deployment/) - Production deployment
- [Configuration Reference](/reference/configuration/) - All options
