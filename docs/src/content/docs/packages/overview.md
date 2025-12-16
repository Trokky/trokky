---
title: Package Overview
description: Understanding Trokky's modular package architecture
---

Trokky is built as a collection of focused packages that can be combined based on your needs. This page provides an overview of all available packages.

## Package Architecture

```
                          Your Application
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
        @trokky/client    @trokky/studio    Your Frontend
              │                  │
              └────────┬─────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
   @trokky/express  @trokky/nextjs  @trokky/cloudflare
         │             │             │
         └─────────────┼─────────────┘
                       │
                @trokky/routes
                       │
                 @trokky/core
                       │
         ┌─────────────┼─────────────┐
         │             │             │
   adapter-filesystem  adapter-s3   adapter-cloudflare
```

## Core Packages

These packages form the foundation of Trokky:

| Package | Description | Required |
|---------|-------------|----------|
| [`@trokky/core`](/packages/core/) | CMS engine with schemas, validation, storage coordination | Yes |
| [`@trokky/routes`](/packages/routes/) | Framework-agnostic HTTP handlers | Yes* |

*Required for API functionality

## Integration Packages

Connect Trokky to your web framework:

| Package | Framework | Description |
|---------|-----------|-------------|
| [`@trokky/express`](/packages/express/) | Express.js | Full-featured Express integration |
| [`@trokky/nextjs`](/packages/nextjs/) | Next.js | App Router API routes |
| [`@trokky/cloudflare`](/packages/cloudflare/) | Cloudflare Workers | Edge runtime deployment |
| `@trokky/hono` | Hono | Lightweight edge framework |

## Storage Adapters

Choose where your content is stored:

| Package | Storage | Best For |
|---------|---------|----------|
| [`@trokky/adapter-filesystem`](/packages/adapters/filesystem/) | Local files | Development, Git workflows |
| [`@trokky/adapter-s3`](/packages/adapters/s3/) | AWS S3 + DynamoDB | AWS deployments |
| [`@trokky/adapter-cloudflare`](/packages/adapters/cloudflare/) | Cloudflare D1 + R2 | Edge deployments |

## Frontend Packages

Build your frontend with Trokky:

| Package | Description |
|---------|-------------|
| [`@trokky/client`](/packages/client/) | Frontend SDK with type generation |
| [`@trokky/studio`](/packages/studio/) | React-based admin interface |

## Package Selection Guide

### Minimal Setup (API Only)

```bash
npm install @trokky/core @trokky/routes @trokky/adapter-filesystem
```

Use this when you want to build a custom API layer.

### Standard Setup (Express + Studio)

```bash
npm install @trokky/core @trokky/express @trokky/adapter-filesystem @trokky/studio
```

The most common setup for Node.js applications.

### Next.js Setup

```bash
npm install @trokky/core @trokky/nextjs @trokky/adapter-filesystem
```

For Next.js App Router projects.

### Edge Setup (Cloudflare)

```bash
npm install @trokky/core @trokky/cloudflare @trokky/adapter-cloudflare
```

For Cloudflare Workers deployments.

### Full Setup (Everything)

```bash
npm install @trokky/core @trokky/express @trokky/adapter-filesystem @trokky/studio @trokky/client
```

Complete setup with admin interface and frontend SDK.

## Version Compatibility

All Trokky packages are versioned together. Always use matching versions:

```json
{
  "dependencies": {
    "@trokky/core": "^0.1.0",
    "@trokky/express": "^0.1.0",
    "@trokky/adapter-filesystem": "^0.1.0"
  }
}
```

## Package Dependencies

Understanding internal dependencies:

```
@trokky/express
  └── @trokky/routes
       └── @trokky/core

@trokky/studio
  └── @trokky/fields (internal)

@trokky/client
  └── (standalone, no Trokky dependencies)

@trokky/adapter-filesystem
  └── @trokky/core (interfaces only)
```

## TypeScript Support

All packages include TypeScript definitions:

- Full type inference from schemas
- Typed API responses
- Auto-completion in editors
- No `@types/*` packages needed

## Next Steps

Explore individual package documentation:

- [@trokky/core](/packages/core/) - Core CMS engine
- [@trokky/express](/packages/express/) - Express integration
- [@trokky/studio](/packages/studio/) - Admin interface
- [@trokky/client](/packages/client/) - Frontend SDK
