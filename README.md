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

### Development Setup

For new contributors or fresh clones:

```bash
# Clone and setup development environment
git clone https://github.com/your-org/trokky-v2.git
cd trokky-v2

# Run complete development setup (recommended)
npm run setup-dev
```

The setup script will:
- Install git hooks to protect main branch
- Configure helpful git aliases
- Install dependencies and build packages
- Verify type checking passes

### Development Workflow

```bash
# Start development (API + Studio)
npm run dev

# Create new feature branch
git new-feature my-awesome-feature

# Build all packages
npm run build

# Run tests
npm run test

# Type checking
npm run type-check

# Finish feature (push + create PR)
git finish-feature
```

## API Documentation

Trokky exposes a comprehensive REST API for content management operations. All API endpoints are mounted at `/api` by default and return JSON responses.

### Base Configuration

```typescript
// API is mounted at /api by default
// Studio is mounted at /studio by default
// All endpoints require JWT or API token authentication unless marked as public

const trokky = await TrokkyExpress.create({
  // ... configuration
})
trokky.mount(app) // Mounts API at /api/* and Studio at /studio/*
```

### Authentication

Trokky supports two authentication methods:
- **JWT Tokens**: 3-part tokens for session-based authentication
- **API Tokens**: 64-character hex strings for server-to-server communication

**Headers:**
```
Authorization: Bearer <jwt-token>
Authorization: Bearer <api-token>
Content-Type: application/json
```

### Standard API Response Format

All API endpoints return responses in this format:

```typescript
interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasNext?: boolean
    hasPrev?: boolean
  }
}
```

### Collections API

#### List Collections
```
GET /api/collections
```
Returns all available content collections.

**Response:**
```json
{
  "success": true,
  "data": ["articles", "pages", "authors"]
}
```

#### List Documents
```
GET /api/collections/:collection
```

**Query Parameters:**
- `limit` - Number of documents to return (default: 20)
- `offset` - Number of documents to skip
- `filter` - JSON object for filtering documents
- `sort` - Field name or array of field names for sorting

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc-123",
      "title": "Sample Article",
      "content": "Article content...",
      "_meta": {
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Create Document
```
POST /api/collections/:collection
```

**Request Body:**
```json
{
  "data": {
    "title": "New Article",
    "content": "Article content...",
    "publishedAt": "2024-01-01T00:00:00.000Z"
  },
  "id": "custom-id" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc-456",
    "title": "New Article",
    "content": "Article content...",
    "_meta": {
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Get Document
```
GET /api/collections/:collection/:id
```

#### Update Document
```
PUT /api/collections/:collection/:id
```

**Request Body:**
```json
{
  "data": {
    "title": "Updated Article Title"
  }
}
```

#### Delete Document
```
DELETE /api/collections/:collection/:id
```

### Search API

#### Search Content
```
GET /api/search
```

**Query Parameters:**
- `q` - Search query string
- `collections` - Comma-separated list of collections to search
- `limit` - Number of results to return
- `offset` - Number of results to skip

### Statistics API

#### Collection Statistics
```
GET /api/stats/:collection
```

Returns document count and other collection metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDocuments": 150,
    "publishedDocuments": 120,
    "draftDocuments": 30,
    "lastModified": "2024-01-01T00:00:00.000Z"
  }
}
```

### Media API

#### List Media Files
```
GET /api/media
```

**Query Parameters:**
- `limit` - Number of files to return
- `offset` - Number of files to skip
- `type` - Filter by MIME type

#### Upload Media
```
POST /api/media/upload
```

**Request:** `multipart/form-data`
- `files` - File upload(s)
- `metadata` - JSON metadata object

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "media-123",
      "filename": "image.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000,
      "variants": {
        "thumbnail": "/api/media/media-123/variants/thumbnail",
        "preview": "/api/media/media-123/variants/preview"
      },
      "url": "/api/media/media-123/file"
    }
  ]
}
```

#### Get Media Info
```
GET /api/media/:id
```

#### Update Media
```
PUT /api/media/:id
```

#### Serve Media File
```
GET /api/media/:id/file
```
Returns the original media file with appropriate content-type headers.

#### Serve Media Variant
```
GET /api/media/:id/variants/:variant
```
Returns processed variant (thumbnail, preview, etc.) of the media file.

#### Regenerate Variants
```
POST /api/media/:id/regenerate-variants
```

#### Delete Media
```
DELETE /api/media/:id
```

### Authentication API (Public)

#### Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "password",
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "refreshToken": "refresh-token-here",
  "user": {
    "id": "user-123",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "expiresAt": "2024-01-01T02:00:00.000Z"
}
```

#### Logout
```
POST /api/auth/logout
```

#### Get Current User
```
GET /api/auth/me
```

#### Validate Token
```
POST /api/auth/validate
```

**Request Body:**
```json
{
  "token": "jwt-or-api-token"
}
```

#### Refresh Token
```
POST /api/auth/refresh
```

### User Management API (Admin Only)

#### List Users
```
GET /api/users
```

**Query Parameters:**
- `role` - Filter by user role
- `isActive` - Filter by active status
- `limit` - Number of users to return
- `offset` - Number of users to skip

#### Create User
```
POST /api/users
```

**Request Body:**
```json
{
  "userData": {
    "username": "newuser",
    "email": "user@example.com",
    "password": "secure-password",
    "firstName": "John",
    "lastName": "Doe",
    "role": "editor"
  }
}
```

#### Get User
```
GET /api/users/:id
```

#### Update User
```
PUT /api/users/:id
```

#### Delete User
```
DELETE /api/users/:id
```

#### Get User by Username
```
GET /api/users/by-username/:username
```

#### Get User by Email
```
GET /api/users/by-email/:email
```

### Token Management API

#### List Tokens
```
GET /api/tokens
```

#### Create Token
```
POST /api/tokens
```

#### Get Token
```
GET /api/tokens/:id
```

#### Update Token
```
PUT /api/tokens/:id
```

#### Delete Token
```
DELETE /api/tokens/:id
```

### Audit Logs API (Read-Only)

#### Document Audit Logs
```
GET /api/audit-logs/documents/:documentId
```

#### Collection Audit Logs
```
GET /api/audit-logs/collections/:collection
```

#### User Activity Logs
```
GET /api/audit-logs/actors/:actorId
```

### Webhook Management API (Admin Only)

#### List Webhooks
```
GET /api/webhooks
```

#### Create Webhook
```
POST /api/webhooks
```

#### Get Webhook
```
GET /api/webhooks/:id
```

#### Update Webhook
```
PUT /api/webhooks/:id
```

#### Delete Webhook
```
DELETE /api/webhooks/:id
```

#### Get Webhook Deliveries
```
GET /api/webhooks/:id/deliveries
```

#### Test Webhook
```
POST /api/webhooks/:id/test
```

### Configuration API

#### Get Schema
```
GET /api/schemas/:schemaName
```

#### Get Studio Structure
```
GET /api/config/structure
```

#### Get Studio Configuration
```
GET /api/config/studio
```

#### Get Settings
```
GET /api/config/settings
```

#### Update Settings
```
PUT /api/config/settings
```

### Utility API

#### Check Slug Uniqueness
```
GET /api/slugs/check-unique
```

**Query Parameters:**
- `slug` - Slug to check
- `collection` - Collection name
- `excludeId` - Document ID to exclude from check

**Response:**
```json
{
  "success": true,
  "data": {
    "unique": true,
    "slug": "my-article",
    "collection": "articles"
  }
}
```

#### Health Check (Public)
```
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### CORS Support
```
OPTIONS /api/*
```

All endpoints support CORS preflight requests.

### Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

Error responses include detailed error information:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required field 'title' is missing",
    "details": {
      "field": "title",
      "value": null
    }
  }
}
```

## Documentation

- **Installation Guide** - Getting started with Trokky
- **API Reference** - Complete API documentation (see above)
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