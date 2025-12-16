---
title: Installation
description: How to install and set up Trokky in your project
---

This guide covers installing Trokky packages and setting up your development environment.

## Prerequisites

Before installing Trokky, ensure you have:

- **Node.js 18+** - Required for multi-environment crypto support
- **npm 8+** - For workspace support (or yarn/pnpm)
- **TypeScript 5+** - Recommended for full type safety

## Installation Options

### Option 1: Express Integration (Recommended)

The fastest way to get started with a Node.js backend:

```bash
npm install @trokky/core @trokky/express @trokky/adapter-filesystem
```

### Option 2: Next.js Integration

For Next.js App Router projects:

```bash
npm install @trokky/core @trokky/nextjs @trokky/adapter-filesystem
```

### Option 3: Core Only

If you want to build your own integration:

```bash
npm install @trokky/core @trokky/routes @trokky/adapter-filesystem
```

## Optional Packages

### Studio (Admin Interface)

```bash
npm install @trokky/studio
```

### Client SDK (Frontend)

```bash
npm install @trokky/client
```

### Alternative Storage Adapters

```bash
# AWS S3 + DynamoDB
npm install @trokky/adapter-s3

# Cloudflare D1 + R2
npm install @trokky/adapter-cloudflare
```

## Media Processing

For image optimization and variant generation, install Sharp:

```bash
npm install sharp
```

Sharp is required if you want to:
- Generate image variants (thumbnails, responsive sizes)
- Optimize uploaded images
- Convert between image formats

## Project Setup

### 1. Create Configuration File

Create a `trokky.config.ts` file in your project root:

```typescript
import { defineConfig } from '@trokky/core';

export default defineConfig({
  // Storage configuration
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
  },

  // Security settings
  security: {
    adminUser: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'changeme',
    },
  },

  // Media settings (optional)
  media: {
    uploadDir: './uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
});
```

### 2. Create Content Directory

```bash
mkdir -p content uploads
```

### 3. Add to .gitignore

```gitignore
# Trokky
uploads/
content/.cache/
```

## TypeScript Configuration

For full type safety, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

## Environment Variables

Create a `.env` file for sensitive configuration:

```bash
# Admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# JWT secret (generate a random string)
TROKKY_JWT_SECRET=your-jwt-secret-key

# Optional: Custom port
PORT=3000
```

## Verify Installation

Create a simple test file to verify everything is working:

```typescript
// test-trokky.ts
import { TrokkyCore } from '@trokky/core';
import { FilesystemAdapter } from '@trokky/adapter-filesystem';

const schemas = [
  {
    name: 'post',
    title: 'Post',
    fields: [
      { name: 'title', type: 'string', required: true },
    ],
  },
];

const storage = new FilesystemAdapter({ contentDir: './content' });
const core = new TrokkyCore({ schemas, storage });

console.log('Trokky initialized successfully!');
console.log('Registered schemas:', core.getSchemas().map(s => s.name));
```

Run with:

```bash
npx tsx test-trokky.ts
```

## Troubleshooting

### "Cannot find module" Errors

Ensure you're using ES modules. Your `package.json` should include:

```json
{
  "type": "module"
}
```

### Sharp Installation Issues

On some systems, Sharp may need native dependencies:

```bash
# macOS
brew install vips

# Ubuntu/Debian
sudo apt-get install libvips-dev

# Then reinstall Sharp
npm rebuild sharp
```

### TypeScript Path Resolution

If imports aren't resolving, check that your bundler/runtime supports TypeScript paths. For Node.js, use `tsx` or `ts-node` with proper configuration.

## Next Steps

With Trokky installed, continue to [Quick Start](/getting-started/quick-start/) to create your first content schema and API.
