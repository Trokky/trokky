# Trokky

> Modern, composable CMS for developers

Trokky is a TypeScript-native content management system designed as a developer-friendly alternative to Sanity. Built with a composable architecture, it offers the flexibility of file-based workflows combined with the power of cloud-scale infrastructure.

## Overview

Trokky provides a complete content management solution with:

- **Local-first development** with Git-friendly file-based storage
- **Framework agnostic** architecture supporting Express, Next.js, Cloudflare Workers, and more
- **TypeScript native** with full type safety from backend to frontend
- **Enterprise-grade security** with JWT authentication and role-based access control
- **Flexible deployment** from local development to edge computing environments

## Architecture

### Core Packages

```
@trokky/core           # CMS engine with schemas, validation, and storage coordination
@trokky/routes         # Framework-agnostic HTTP route handlers
@trokky/studio         # React-based admin interface
@trokky/client         # Frontend SDK with TypeScript type generation
@trokky/fields         # Comprehensive field system with React components
```

### Framework Integrations

```
@trokky/express        # Express.js server integration
@trokky/nextjs         # Next.js App Router integration
@trokky/hono           # Hono edge runtime integration
@trokky/cloudflare     # Cloudflare Workers integration
```

### Storage Adapters

```
@trokky/adapter-filesystem    # File-based storage (default, Git-friendly)
@trokky/adapter-cloudflare    # Cloudflare D1 + R2 storage
@trokky/adapter-s3            # AWS S3 + DynamoDB storage
```

## Quick Start

### Express.js Integration

```typescript
import express from 'express'
import { TrokkyExpress } from '@trokky/express'

const app = express()

const trokky = await TrokkyExpress.create({
  schemas: [
    {
      name: 'article',
      title: 'Article',
      type: 'document',
      fields: {
        title: { type: 'string', title: 'Title', required: true },
        content: { type: 'richtext', title: 'Content' },
        publishedAt: { type: 'date', title: 'Published At' }
      }
    }
  ],
  storage: { adapter: 'filesystem', contentDir: './content' },
  studio: { enabled: true, branding: { title: 'My CMS' } }
})

// Mounts /api/* and /studio/* routes
trokky.mount(app)

app.listen(3000)
```

### Configuration

Trokky uses a centralized configuration approach with environment-aware defaults:

```typescript
// trokky.config.ts
export default {
  schemas: './schemas',
  storage: {
    adapter: 'filesystem',
    contentDir: './content'
  },
  studio: {
    enabled: true,
    branding: {
      title: 'My CMS',
      description: 'Content management made simple'
    }
  },
  security: {
    adminUser: {
      username: process.env.TROKKY_ADMIN_EMAIL,
      password: process.env.TROKKY_ADMIN_PASSWORD
    }
  }
}
```

## Features

### Content Management

- **Schema-driven** content modeling with TypeScript definitions
- **Field system** with built-in validation and custom field types
- **Media management** with automatic processing and variant generation
- **Reference fields** with automatic relationship management
- **Draft and publish** workflows with version control

### Developer Experience

- **Type generation** for frontend development with full IntelliSense
- **Hot reloading** during development with file watching
- **CLI tools** for project setup and content generation
- **Migration tools** for importing from other CMSs

### Security & Authentication

- **JWT-based authentication** with configurable token expiration
- **Role-based access control** (admin, editor, viewer)
- **Multi-environment crypto** adapters for Node.js and edge environments
- **Audit logging** for compliance and security monitoring
- **Admin access control** with automatic permission validation

### Deployment Flexibility

- **Local development** with file-based storage
- **Cloud deployment** with scalable storage adapters
- **Edge computing** support for Cloudflare Workers and similar platforms
- **Container-ready** with Docker support and health checks

## Project Structure

### Monorepo Organization

```
packages/
├── core/                    # CMS engine
├── routes/                  # HTTP route handlers
├── studio/                  # Admin interface
├── client/                  # Frontend SDK
├── fields/                  # Field system
├── structure/               # Studio structure utilities
├── integrations/
│   ├── express/            # Express.js integration
│   ├── nextjs/             # Next.js integration
│   ├── hono/               # Hono integration
│   └── cloudflare/         # Cloudflare Workers integration
└── adapters/
    ├── filesystem/         # File-based storage
    ├── filesystem-data/    # File-based data storage
    ├── filesystem-media/   # File-based media storage
    ├── cloudflare-d1/      # Cloudflare D1 database
    ├── cloudflare-r2/      # Cloudflare R2 storage
    └── s3/                 # AWS S3 storage
```

### Development Workflow

The project uses npm workspaces with Turbo for efficient development:

```bash
# Install dependencies
npm install

# Start development (API + Studio)
npm run dev

# Build all packages
npm run build

# Run tests
npm run test

# Type checking
npm run type-check
```

## Documentation

- **Installation Guide** - Getting started with Trokky
- **API Reference** - Complete API documentation
- **Configuration Guide** - Advanced configuration options
- **Migration Guide** - Moving from other CMSs
- **Deployment Guide** - Production deployment strategies

## Development Status

Trokky v2 represents a complete architectural rewrite focused on modularity and developer experience.

### Production Ready

- **Core engine** with comprehensive schema and validation system
- **File-based storage** adapter with security hardening
- **Framework-agnostic routes** with full CRUD operations
- **Express.js integration** with production-ready middleware
- **Authentication system** with enterprise-grade security

### In Development

- **Studio interface** enhancements and user experience improvements
- **Client SDK** with advanced type generation capabilities
- **Additional framework integrations** and storage adapters

## Contributing

Trokky is built with modern development practices and comprehensive testing. See the contributing guide for development setup and guidelines.

## License

MIT License - see LICENSE file for details.

---

Built for developers who want the power of enterprise CMS with the simplicity of modern development workflows.