---
title: Introduction
description: Learn what Trokky is and why it was built
---

Trokky is a modern, composable Content Management System designed as a developer-friendly alternative to platforms like Sanity. It follows a modular package-based architecture with local-first development and framework-agnostic design principles.

## What is Trokky?

Trokky is a headless CMS that gives developers full control over their content infrastructure. Unlike monolithic CMS platforms, Trokky is built from small, focused packages that you can combine based on your needs.

### Key Characteristics

- **Headless**: Content API separate from presentation layer
- **Self-hosted**: Run on your own infrastructure
- **Open architecture**: Extend and customize every layer
- **Developer-first**: Built for developers who want control

## Design Philosophy

### Composability over Monolith

Traditional CMS platforms force you to use their entire stack. Trokky takes a different approach: use only what you need.

```
Need just the API?           -> @trokky/core + @trokky/routes
Want the admin interface?    -> Add @trokky/studio
Using Express?               -> Add @trokky/express
Prefer file storage?         -> Use @trokky/adapter-filesystem
Need cloud storage?          -> Swap to @trokky/adapter-s3
```

### Local-First Development

By default, Trokky stores content as files on your filesystem. This means:

- **Git-friendly**: Version control your content alongside code
- **No database required**: Start developing immediately
- **Portable**: Move content between environments easily
- **Transparent**: Inspect and edit content directly

### TypeScript Native

Every layer of Trokky is built with TypeScript:

- Schemas define your content structure with full type inference
- API responses are fully typed
- The client SDK generates types from your schemas
- Studio components have complete type safety

### Framework Agnostic

The core of Trokky doesn't depend on any specific web framework. Framework integrations are thin adapters that connect Trokky to:

- Express.js
- Next.js (App Router)
- Cloudflare Workers
- Hono
- Any framework that handles HTTP requests

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
├─────────────────────────────────────────────────────────┤
│  @trokky/client          │  @trokky/studio              │
│  (Frontend SDK)          │  (Admin Interface)           │
├─────────────────────────────────────────────────────────┤
│  @trokky/express | @trokky/nextjs | @trokky/cloudflare  │
│  (Framework Integrations)                                │
├─────────────────────────────────────────────────────────┤
│                    @trokky/routes                        │
│              (Framework-agnostic Handlers)               │
├─────────────────────────────────────────────────────────┤
│                     @trokky/core                         │
│         (Schemas, Validation, Business Logic)            │
├─────────────────────────────────────────────────────────┤
│  @trokky/adapter-filesystem | adapter-s3 | adapter-cf   │
│  (Storage Adapters)                                      │
└─────────────────────────────────────────────────────────┘
```

## Who is Trokky For?

Trokky is ideal for:

- **Developers** who want full control over their CMS
- **Teams** who prefer Git-based content workflows
- **Projects** that need type-safe content APIs
- **Applications** requiring custom content structures
- **Organizations** wanting self-hosted content management

## Comparison with Alternatives

| Feature | Trokky | Sanity | Strapi | Contentful |
|---------|--------|--------|--------|------------|
| Self-hosted | Yes | No | Yes | No |
| Local-first | Yes | No | No | No |
| TypeScript native | Yes | Partial | Partial | No |
| Modular packages | Yes | No | No | No |
| Git-friendly content | Yes | No | No | No |
| Free tier limits | None | Yes | None | Yes |

## Next Steps

Ready to try Trokky? Continue to [Installation](/getting-started/installation/) to set up your first project.
