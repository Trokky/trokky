---
title: HTTP API Reference
description: Complete REST API documentation for Trokky
---

This reference documents all HTTP endpoints provided by Trokky.

## Base URL

All endpoints are relative to your API base path (default: `/api`).

```
https://your-domain.com/api
```

## Authentication

Protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Documents

### List Documents

```http
GET /api/documents/:type
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Items per page |
| `offset` | number | 0 | Skip items |
| `orderBy` | string | `_createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |
| `expand` | string | - | Comma-separated references to expand |
| `filter[field]` | any | - | Filter by field value |

**Example:**

```bash
curl "http://localhost:3000/api/documents/post?limit=10&orderBy=publishedAt&order=desc"
```

**Response:**

```json
{
  "data": [
    {
      "_id": "abc123",
      "_type": "post",
      "_createdAt": "2024-01-15T10:00:00Z",
      "_updatedAt": "2024-01-16T14:30:00Z",
      "title": "My Post",
      "slug": { "current": "my-post" }
    }
  ],
  "meta": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}
```

### Get Document

```http
GET /api/documents/:type/:id
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `expand` | string | References to expand |

**Example:**

```bash
curl "http://localhost:3000/api/documents/post/abc123?expand=author"
```

**Response:**

```json
{
  "data": {
    "_id": "abc123",
    "_type": "post",
    "title": "My Post",
    "author": {
      "_id": "author-xyz",
      "_type": "author",
      "name": "John Doe"
    }
  }
}
```

### Create Document

```http
POST /api/documents/:type
```

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "title": "New Post",
  "content": "Post content here",
  "status": "draft"
}
```

**Response:**

```json
{
  "data": {
    "_id": "new-id-123",
    "_type": "post",
    "_createdAt": "2024-01-20T10:00:00Z",
    "_updatedAt": "2024-01-20T10:00:00Z",
    "title": "New Post",
    "content": "Post content here",
    "status": "draft"
  }
}
```

### Update Document

```http
PUT /api/documents/:type/:id
```

Replaces the entire document.

**Body:**

```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "status": "published"
}
```

### Partial Update

```http
PATCH /api/documents/:type/:id
```

Updates only specified fields.

**Body:**

```json
{
  "status": "published",
  "publishedAt": "2024-01-20T10:00:00Z"
}
```

### Delete Document

```http
DELETE /api/documents/:type/:id
```

**Response:**

```json
{
  "success": true
}
```

---

## Media

### List Media

```http
GET /api/media
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Items per page |
| `offset` | number | Skip items |
| `type` | string | Filter by MIME type prefix (e.g., `image`) |
| `search` | string | Search filename |

**Response:**

```json
{
  "data": [
    {
      "_id": "media-abc123",
      "filename": "photo.jpg",
      "originalFilename": "IMG_1234.jpg",
      "mimeType": "image/jpeg",
      "size": 245678,
      "width": 1920,
      "height": 1080,
      "alt": "Description",
      "url": "/media/photo-abc123.jpg",
      "variants": {
        "thumb": "/media/photo-abc123-thumb.webp",
        "medium": "/media/photo-abc123-medium.webp"
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Media

```http
GET /api/media/:id
```

### Upload Media

```http
POST /api/media
```

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The file to upload |
| `alt` | string | No | Alt text |
| `title` | string | No | Media title |

**Example (curl):**

```bash
curl -X POST http://localhost:3000/api/media \
  -H "Authorization: Bearer <token>" \
  -F "file=@photo.jpg" \
  -F "alt=My photo"
```

**Response:**

```json
{
  "data": {
    "_id": "media-new123",
    "filename": "photo.jpg",
    "url": "/media/photo-new123.jpg",
    "variants": {
      "thumb": "/media/photo-new123-thumb.webp"
    }
  }
}
```

### Update Media Metadata

```http
PATCH /api/media/:id
```

**Body:**

```json
{
  "alt": "Updated description",
  "title": "New title"
}
```

### Delete Media

```http
DELETE /api/media/:id
```

---

## Authentication

### Login

```http
POST /api/auth/login
```

**Body:**

```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-abc123",
    "username": "admin",
    "role": "admin",
    "name": "Administrator"
  },
  "expiresAt": "2024-01-27T10:00:00Z"
}
```

### Get Current User

```http
GET /api/auth/me
```

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "id": "user-abc123",
    "username": "admin",
    "role": "admin",
    "name": "Administrator"
  }
}
```

### Refresh Token

```http
POST /api/auth/refresh
```

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2024-01-27T10:00:00Z"
}
```

### Logout

```http
POST /api/auth/logout
```

---

## Configuration

### Get Schemas

```http
GET /api/config/schemas
```

Returns all registered schemas.

**Response:**

```json
{
  "data": [
    {
      "name": "post",
      "title": "Blog Post",
      "fields": [...]
    },
    {
      "name": "author",
      "title": "Author",
      "fields": [...]
    }
  ]
}
```

### Get Studio Config

```http
GET /api/config/studio
```

Returns Studio configuration.

### Get Structure

```http
GET /api/config/structure
```

Returns navigation structure (may be personalized based on user).

---

## Error Responses

### Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [...]
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

### Validation Error Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "title",
        "message": "Required field"
      },
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## Filtering

### Basic Filtering

```
GET /api/documents/post?filter[status]=published
```

### Multiple Filters

```
GET /api/documents/post?filter[status]=published&filter[featured]=true
```

### Reference Filtering

```
GET /api/documents/post?filter[author]=author-abc123
```

---

## Expanding References

### Single Reference

```
GET /api/documents/post/abc123?expand=author
```

### Multiple References

```
GET /api/documents/post/abc123?expand=author,categories
```

### Nested References

```
GET /api/documents/post/abc123?expand=author.company
```

---

## Rate Limiting

When rate limited, the API returns:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

---

## Examples

### JavaScript/TypeScript

```typescript
// Using fetch
const response = await fetch('http://localhost:3000/api/documents/post', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const { data } = await response.json();

// Create document
const newPost = await fetch('http://localhost:3000/api/documents/post', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'New Post',
    content: 'Content here',
  }),
});
```

### cURL

```bash
# List documents
curl http://localhost:3000/api/documents/post

# Create document
curl -X POST http://localhost:3000/api/documents/post \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Post"}'

# Upload media
curl -X POST http://localhost:3000/api/media \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@image.jpg" \
  -F "alt=Image description"
```
