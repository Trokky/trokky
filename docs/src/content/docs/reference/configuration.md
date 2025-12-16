---
title: Configuration Reference
description: Complete configuration options for Trokky
---

This reference documents all configuration options available in Trokky.

## Configuration File

Create `trokky.config.ts` in your project root:

```typescript
import { defineConfig } from '@trokky/core';

export default defineConfig({
  schemas: [...],
  storage: { ... },
  security: { ... },
  media: { ... },
  server: { ... },
  studio: { ... },
});
```

## Top-Level Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `schemas` | `Schema[]` | Yes | Content type definitions |
| `storage` | `StorageConfig` | Yes | Storage adapter configuration |
| `security` | `SecurityConfig` | No | Authentication and security |
| `media` | `MediaConfig` | No | Media handling settings |
| `server` | `ServerConfig` | No | HTTP server settings |
| `studio` | `StudioConfig` | No | Admin interface settings |
| `features` | `FeaturesConfig` | No | Optional features |
| `hooks` | `HooksConfig` | No | Lifecycle hooks |
| `webhooks` | `WebhooksConfig` | No | Webhook endpoints |

---

## Storage Configuration

### Filesystem

```typescript
storage: {
  adapter: 'filesystem',
  contentDir: './content',    // Document storage
  mediaDir: './uploads',      // Media storage
  pretty: true,               // Pretty-print JSON
  indexing: true,             // Enable query cache
}
```

### S3

```typescript
storage: {
  adapter: 's3',
  region: 'us-east-1',
  bucket: 'my-bucket',
  tableName: 'trokky-docs',
  prefix: 'content/',         // Optional key prefix
  credentials: {              // Optional (uses default chain)
    accessKeyId: '...',
    secretAccessKey: '...',
  },
}
```

### Cloudflare

```typescript
storage: {
  adapter: 'cloudflare',
  d1: env.DB,                 // D1 binding
  r2: env.STORAGE,            // R2 binding
  mediaPrefix: 'media/',      // R2 key prefix
}
```

---

## Security Configuration

```typescript
security: {
  // JWT settings
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiry: '7d',
  refreshTokenExpiry: '30d',

  // Admin user (created on startup)
  adminUser: {
    username: 'admin',
    password: 'secure-password',
    email: 'admin@example.com',
  },

  // Password policy
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: false,
  },

  // Bcrypt settings
  bcryptRounds: 12,

  // Rate limiting
  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000,
      max: 5,
    },
    api: {
      windowMs: 60 * 1000,
      max: 100,
    },
  },

  // Session settings
  session: {
    maxConcurrent: 5,
    revokeOnPasswordChange: true,
  },

  // Cookie settings (if using cookies)
  cookie: {
    name: 'trokky-token',
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },

  // Audit logging
  auditLog: {
    enabled: true,
    events: ['login', 'logout', 'loginFailed', 'passwordChange'],
  },
}
```

---

## Media Configuration

```typescript
media: {
  // Storage
  uploadDir: './uploads',

  // Limits
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 10,                    // Per request

  // Allowed types
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ],

  // Image processing
  processor: 'sharp',
  quality: 80,
  format: 'webp',                  // Convert to format

  // Variants
  variants: [
    { name: 'thumb', width: 200, height: 200, fit: 'cover' },
    { name: 'small', width: 400 },
    { name: 'medium', width: 800 },
    { name: 'large', width: 1600 },
    { name: 'og', width: 1200, height: 630, fit: 'cover' },
  ],

  // URLs
  baseUrl: 'https://cdn.example.com',
  pathPrefix: '/media',

  // Processing options
  lazyVariants: false,             // Generate on-demand
  removeOriginal: false,           // Keep original file
  extractMetadata: true,           // Extract EXIF, etc.
}
```

### Variant Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Variant identifier |
| `width` | `number` | Max width in pixels |
| `height` | `number` | Max height in pixels |
| `fit` | `string` | `cover`, `contain`, `fill`, `inside`, `outside` |
| `format` | `string` | `jpeg`, `png`, `webp`, `avif` |
| `quality` | `number` | Output quality (1-100) |

---

## Server Configuration

```typescript
server: {
  // Base path
  basePath: '/api',

  // CORS
  cors: {
    origin: ['http://localhost:3000', 'https://app.example.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  },

  // Body parsing
  bodyLimit: '10mb',

  // Trust proxy
  trustProxy: true,

  // Rate limiting
  rateLimit: {
    enabled: true,
    windowMs: 60 * 1000,
    max: 100,
  },

  // Request logging
  logging: {
    enabled: true,
    format: 'combined',
  },
}
```

---

## Studio Configuration

```typescript
studio: {
  // Enable/disable
  enabled: true,

  // URL path
  basePath: '/studio',

  // Branding
  branding: {
    title: 'My CMS',
    logo: '/logo.svg',
    logoAlt: 'Company Logo',
    favicon: '/favicon.ico',
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      accent: '#f59e0b',
    },
    customCss: '...',
  },

  // Navigation structure
  structure: [
    { type: 'list', schemaType: 'post', title: 'Posts' },
    { type: 'singleton', schemaType: 'settings' },
  ],

  // Document actions
  documentActions: [
    {
      label: 'Publish',
      icon: 'check',
      action: async (doc, { client }) => { ... },
      visible: (doc) => doc.status === 'draft',
    },
  ],

  // Dashboard widgets
  dashboard: {
    widgets: [
      { type: 'recentDocuments', schemaType: 'post', limit: 5 },
      { type: 'documentCount', schemaTypes: ['post', 'page'] },
    ],
  },

  // Preview
  preview: {
    enabled: true,
    url: (doc) => `https://preview.example.com/${doc._type}/${doc.slug}`,
    position: 'right',
    width: '50%',
  },

  // Access control
  access: {
    schemas: {
      siteSettings: ['admin'],
      post: ['admin', 'editor', 'writer'],
    },
  },

  // Features
  features: {
    mediaLibrary: true,
    darkMode: true,
    search: true,
    revisionHistory: true,
    bulkActions: ['admin', 'editor'],
  },

  // Development
  dev: {
    hotReload: true,
    port: 5173,
  },

  // Debug
  debug: {
    showFieldNames: false,
    logApiCalls: false,
  },
}
```

---

## Features Configuration

```typescript
features: {
  // Auto-thumbnail injection
  autoThumbnail: {
    enabled: true,
    fieldName: '_thumbnail',
    skipSingletons: true,
    skipSchemas: ['settings', 'navigation'],
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  // Auto-slug generation
  autoSlug: {
    enabled: true,
    sourceFields: ['title', 'name'],
    unique: true,
  },
}
```

---

## Hooks Configuration

```typescript
hooks: {
  // Before document save
  beforeSave: async (doc, schema) => {
    doc.updatedAt = new Date().toISOString();
    return doc;
  },

  // After document save
  afterSave: async (doc, schema) => {
    if (doc.status === 'published') {
      await notifySubscribers(doc);
    }
  },

  // Before document delete
  beforeDelete: async (doc, schema) => {
    if (doc.protected) {
      throw new Error('Cannot delete protected document');
    }
  },

  // After document delete
  afterDelete: async (doc, schema) => {
    await cleanupRelatedData(doc);
  },

  // Before media upload
  beforeUpload: async (file, metadata) => {
    // Validate or transform file
    return { file, metadata };
  },

  // After media upload
  afterUpload: async (asset) => {
    await indexMedia(asset);
  },
}
```

---

## Webhooks Configuration

```typescript
webhooks: {
  endpoints: [
    {
      url: 'https://example.com/webhook',
      events: [
        'document:created',
        'document:updated',
        'document:deleted',
        'media:uploaded',
        'media:deleted',
      ],
      secret: process.env.WEBHOOK_SECRET,
      headers: {
        'X-Custom-Header': 'value',
      },
    },
  ],
  retries: 3,
  retryDelay: 1000,
}
```

---

## Environment-Based Configuration

```typescript
import { defineConfig, withDefaults } from '@trokky/core';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig(withDefaults({
  schemas: [...],

  storage: isDev
    ? { adapter: 'filesystem', contentDir: './content' }
    : { adapter: 's3', region: '...', bucket: '...' },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    // Development defaults applied automatically
  },

  server: {
    cors: {
      origin: isDev
        ? 'http://localhost:5173'
        : process.env.CORS_ORIGIN,
    },
  },
}));
```

---

## TypeScript Types

```typescript
import type {
  TrokkyConfig,
  Schema,
  StorageConfig,
  SecurityConfig,
  MediaConfig,
  ServerConfig,
  StudioConfig,
} from '@trokky/core';
```
