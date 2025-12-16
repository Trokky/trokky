---
title: "@trokky/routes"
description: Framework-agnostic HTTP handlers for the Trokky API
---

`@trokky/routes` provides framework-agnostic HTTP handlers that can be adapted to any web framework. It defines the REST API structure and handles request/response transformation.

## Installation

```bash
npm install @trokky/routes
```

Note: This package is typically used through framework integrations like `@trokky/express` rather than directly.

## Concepts

### Framework Agnostic Design

Routes are defined as pure functions that take an `HttpRequest` and return an `HttpResponse`:

```typescript
type RouteHandler = (
  request: HttpRequest,
  context: RouteContext
) => Promise<HttpResponse>;
```

Framework adapters convert between framework-specific request/response objects and this standard format.

### HttpRequest

```typescript
interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  headers: Record<string, string>;
  user?: User;
}
```

### HttpResponse

```typescript
interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
}
```

## API Routes

### Documents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/documents/:type` | List documents |
| `GET` | `/api/documents/:type/:id` | Get document |
| `POST` | `/api/documents/:type` | Create document |
| `PUT` | `/api/documents/:type/:id` | Update document |
| `PATCH` | `/api/documents/:type/:id` | Partial update |
| `DELETE` | `/api/documents/:type/:id` | Delete document |

### Media

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/media` | List media |
| `GET` | `/api/media/:id` | Get media |
| `POST` | `/api/media` | Upload media |
| `PATCH` | `/api/media/:id` | Update metadata |
| `DELETE` | `/api/media/:id` | Delete media |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/logout` | User logout |
| `POST` | `/api/auth/refresh` | Refresh token |
| `GET` | `/api/auth/me` | Current user |

### Configuration

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config/schemas` | Get schemas |
| `GET` | `/api/config/studio` | Studio config |
| `GET` | `/api/config/structure` | Navigation structure |

## Direct Usage

For custom integrations, you can use route handlers directly:

```typescript
import { createRouteHandlers, RouteContext } from '@trokky/routes';
import { TrokkyCore } from '@trokky/core';

const core = new TrokkyCore({ /* config */ });

const handlers = createRouteHandlers(core);

// Use handlers in your framework
const response = await handlers.documents.list({
  method: 'GET',
  path: '/api/documents/post',
  params: { type: 'post' },
  query: { limit: '10' },
  headers: {},
});

// response = { status: 200, body: { data: [...] } }
```

## Route Handler Types

### Document Handlers

```typescript
interface DocumentHandlers {
  list(request: HttpRequest): Promise<HttpResponse>;
  get(request: HttpRequest): Promise<HttpResponse>;
  create(request: HttpRequest): Promise<HttpResponse>;
  update(request: HttpRequest): Promise<HttpResponse>;
  patch(request: HttpRequest): Promise<HttpResponse>;
  delete(request: HttpRequest): Promise<HttpResponse>;
}
```

### Media Handlers

```typescript
interface MediaHandlers {
  list(request: HttpRequest): Promise<HttpResponse>;
  get(request: HttpRequest): Promise<HttpResponse>;
  upload(request: HttpRequest): Promise<HttpResponse>;
  update(request: HttpRequest): Promise<HttpResponse>;
  delete(request: HttpRequest): Promise<HttpResponse>;
}
```

### Auth Handlers

```typescript
interface AuthHandlers {
  login(request: HttpRequest): Promise<HttpResponse>;
  logout(request: HttpRequest): Promise<HttpResponse>;
  refresh(request: HttpRequest): Promise<HttpResponse>;
  me(request: HttpRequest): Promise<HttpResponse>;
}
```

## Query Parameters

### List Documents

```
GET /api/documents/post?limit=10&offset=0&orderBy=createdAt&order=desc
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Items per page |
| `offset` | number | 0 | Skip items |
| `orderBy` | string | `_createdAt` | Sort field |
| `order` | string | `desc` | Sort direction |
| `expand` | string | - | Expand references |

### Filtering

```
GET /api/documents/post?filter[status]=published&filter[author]=author-123
```

### Reference Expansion

```
GET /api/documents/post?expand=author,categories
```

Returns documents with expanded references:

```json
{
  "_id": "post-123",
  "title": "My Post",
  "author": {
    "_id": "author-456",
    "name": "John Doe"
  }
}
```

## Response Formats

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "limit": 10,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "title", "message": "Required field" }
    ]
  }
}
```

## Middleware

### Authentication Middleware

```typescript
import { authMiddleware } from '@trokky/routes';

const middleware = authMiddleware({
  jwtSecret: process.env.JWT_SECRET,
  exclude: ['/api/auth/login', '/api/documents/*:GET'],
});
```

### Rate Limiting

```typescript
import { rateLimitMiddleware } from '@trokky/routes';

const middleware = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

## Creating Custom Adapters

To create an adapter for a new framework:

```typescript
import { createRouteHandlers, HttpRequest, HttpResponse } from '@trokky/routes';

// Convert framework request to HttpRequest
function toHttpRequest(frameworkRequest: any): HttpRequest {
  return {
    method: frameworkRequest.method,
    path: frameworkRequest.url,
    params: frameworkRequest.params,
    query: frameworkRequest.query,
    body: frameworkRequest.body,
    headers: frameworkRequest.headers,
    user: frameworkRequest.user,
  };
}

// Convert HttpResponse to framework response
function toFrameworkResponse(response: HttpResponse, frameworkRes: any) {
  frameworkRes.status(response.status);
  if (response.headers) {
    Object.entries(response.headers).forEach(([key, value]) => {
      frameworkRes.setHeader(key, value);
    });
  }
  frameworkRes.json(response.body);
}

// Create handler
export function createHandler(core: TrokkyCore) {
  const handlers = createRouteHandlers(core);

  return async (frameworkReq: any, frameworkRes: any) => {
    const request = toHttpRequest(frameworkReq);
    const response = await handlers.route(request);
    toFrameworkResponse(response, frameworkRes);
  };
}
```

## Security

### Input Validation

All inputs are validated against schemas:

- Path traversal protection
- SQL injection prevention
- XSS sanitization
- Size limits

### Authentication

Protected routes require valid JWT:

```typescript
// Public routes (no auth required)
GET /api/documents/*
GET /api/media/*
POST /api/auth/login

// Protected routes (auth required)
POST /api/documents/*
PUT /api/documents/*
DELETE /api/documents/*
POST /api/media
```

## Next Steps

- [@trokky/express](/packages/express/) - Express integration
- [@trokky/nextjs](/packages/nextjs/) - Next.js integration
- [HTTP API Reference](/reference/http-api/) - Complete API documentation
