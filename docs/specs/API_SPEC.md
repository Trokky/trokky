# Trokky v2 - API Specification

## 🔌 API Overview

Trokky v2 provides both **REST** and **GraphQL** APIs, automatically generated from your content schemas. This dual approach gives developers the flexibility to choose the best API pattern for their use case.

## 🗂️ REST API

### Base URL Structure
```
/api/documents/:collection     # Document operations
/api/media                     # Media operations  
/api/graphql                   # GraphQL endpoint
/api/schemas                   # Schema introspection
/studio/*                      # Studio static files
```

### Authentication

#### API Token Authentication
```http
Authorization: Bearer <api_token>
```

#### Session Authentication (Studio)
```http
Cookie: trokky_session=<session_token>
```

## 📄 Document Operations

### List Documents
```http
GET /api/documents/:collection
```

**Parameters:**
- `limit` (number, default: 50) - Number of documents to return
- `offset` (number, default: 0) - Number of documents to skip
- `filter` (JSON string) - Filter criteria
- `sort` (string) - Sort field and direction (e.g., "_createdAt_DESC")
- `select` (string) - Comma-separated fields to include

**Example:**
```http
GET /api/documents/blog-posts?limit=10&sort=_createdAt_DESC&select=title,slug,_createdAt
```

**Response:**
```json
{
  "data": [
    {
      "id": "blog-post-1",
      "title": "My First Post",
      "slug": "my-first-post",
      "_createdAt": "2024-01-15T10:30:00Z",
      "_collection": "blog-posts"
    }
  ],
  "meta": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Single Document
```http
GET /api/documents/:collection/:id
```

**Example:**
```http
GET /api/documents/blog-posts/my-first-post
```

**Response:**
```json
{
  "data": {
    "id": "my-first-post",
    "title": "My First Post",
    "slug": "my-first-post",
    "content": "This is my first blog post...",
    "author": {
      "id": "author-1",
      "name": "John Doe"
    },
    "tags": ["technology", "cms"],
    "_collection": "blog-posts",
    "_createdAt": "2024-01-15T10:30:00Z",
    "_updatedAt": "2024-01-15T11:45:00Z",
    "_status": "published"
  }
}
```

### Create Document
```http
POST /api/documents/:collection
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "New Blog Post",
  "slug": "new-blog-post",
  "content": "Content of the new post...",
  "author": "author-1",
  "tags": ["cms", "development"],
  "_status": "draft"
}
```

**Response:**
```json
{
  "data": {
    "id": "generated-uuid",
    "title": "New Blog Post",
    "slug": "new-blog-post",
    "_collection": "blog-posts",
    "_createdAt": "2024-01-20T14:30:00Z",
    "_updatedAt": "2024-01-20T14:30:00Z",
    "_status": "draft"
  }
}
```

### Update Document
```http
PUT /api/documents/:collection/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Blog Post Title",
  "_status": "published"
}
```

### Delete Document
```http
DELETE /api/documents/:collection/:id
```

**Response:**
```json
{
  "data": {
    "id": "blog-post-1",
    "deleted": true
  }
}
```

## 🖼️ Media Operations

### Upload Media
```http
POST /api/media/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (File) - The media file to upload
- `alt` (string, optional) - Alt text for images
- `caption` (string, optional) - Caption text

**Response:**
```json
{
  "data": {
    "id": "media-uuid",
    "url": "https://cdn.example.com/images/photo.jpg",
    "filename": "photo.jpg",
    "size": 1024000,
    "type": "image/jpeg",
    "alt": "A beautiful sunset",
    "width": 1920,
    "height": 1080,
    "_createdAt": "2024-01-20T15:00:00Z"
  }
}
```

### Get Media
```http
GET /api/media/:id
```

### Delete Media
```http
DELETE /api/media/:id
```

### List Media
```http
GET /api/media
```

**Parameters:**
- `type` (string) - Filter by media type (image, video, document)
- `limit` (number, default: 50)
- `offset` (number, default: 0)

## 🎯 GraphQL API

### Endpoint
```http
POST /api/graphql
Content-Type: application/json
```

### Auto-Generated Schema

The GraphQL schema is automatically generated from your content schemas:

```graphql
# Document types
type BlogPost {
  id: ID!
  title: String!
  slug: String!
  content: RichText
  author: Author
  tags: [String!]!
  _collection: String!
  _createdAt: DateTime!
  _updatedAt: DateTime!
  _status: DocumentStatus!
}

type Author {
  id: ID!
  name: String!
  email: String!
  bio: RichText
  avatar: Media
  _collection: String!
  _createdAt: DateTime!
  _updatedAt: DateTime!
}

# Input types for mutations
input BlogPostInput {
  title: String!
  slug: String
  content: RichText
  author: ID
  tags: [String!]
  _status: DocumentStatus
}

# Filter and sorting inputs
input BlogPostFilter {
  title_contains: String
  author: ID
  tags_in: [String!]
  _status: DocumentStatus
}

input BlogPostSort {
  field: BlogPostSortField!
  direction: SortDirection!
}

enum BlogPostSortField {
  title
  _createdAt
  _updatedAt
}

enum SortDirection {
  ASC
  DESC
}

# Root types
type Query {
  # Single document queries
  blogPost(id: ID!): BlogPost
  author(id: ID!): Author
  
  # Collection queries
  blogPosts(
    filter: BlogPostFilter
    sort: BlogPostSort
    limit: Int = 50
    offset: Int = 0
  ): BlogPostConnection!
  
  authors(
    filter: AuthorFilter
    sort: AuthorSort  
    limit: Int = 50
    offset: Int = 0
  ): AuthorConnection!
  
  # Media queries
  media(id: ID!): Media
  allMedia(
    type: MediaType
    limit: Int = 50
    offset: Int = 0
  ): MediaConnection!
}

type Mutation {
  # Document mutations
  createBlogPost(data: BlogPostInput!): BlogPost!
  updateBlogPost(id: ID!, data: BlogPostInput!): BlogPost!
  deleteBlogPost(id: ID!): Boolean!
  
  createAuthor(data: AuthorInput!): Author!
  updateAuthor(id: ID!, data: AuthorInput!): Author!
  deleteAuthor(id: ID!): Boolean!
  
  # Media mutations
  uploadMedia(file: Upload!, alt: String, caption: String): Media!
  deleteMedia(id: ID!): Boolean!
}

# Connection types for pagination
type BlogPostConnection {
  nodes: [BlogPost!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}
```

### Example Queries

**Get blog posts with author information:**
```graphql
query GetBlogPosts {
  blogPosts(
    filter: { _status: published }
    sort: { field: _createdAt, direction: DESC }
    limit: 10
  ) {
    nodes {
      id
      title
      slug
      content
      author {
        id
        name
        avatar {
          url
          alt
        }
      }
      tags
      _createdAt
    }
    totalCount
    hasNextPage
  }
}
```

**Create a new blog post:**
```graphql
mutation CreateBlogPost {
  createBlogPost(data: {
    title: "Getting Started with GraphQL"
    slug: "getting-started-graphql"
    content: "GraphQL is a query language..."
    author: "author-1"
    tags: ["graphql", "api", "tutorial"]
    _status: draft
  }) {
    id
    title
    slug
    _status
    _createdAt
  }
}
```

## 🔍 Schema Introspection

### Get All Schemas
```http
GET /api/schemas
```

**Response:**
```json
{
  "data": {
    "blog-posts": {
      "name": "blog-posts",
      "title": "Blog Posts",
      "type": "collection",
      "fields": {
        "title": {
          "type": "string",
          "required": true,
          "validation": {
            "minLength": 1,
            "maxLength": 200
          }
        },
        "slug": {
          "type": "slug",
          "source": "title",
          "required": true
        },
        "content": {
          "type": "richText",
          "required": true
        }
      }
    }
  }
}
```

### Get Single Schema
```http
GET /api/schemas/:collection
```

## 🚨 Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Document validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required",
        "code": "REQUIRED_FIELD"
      },
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      }
    ]
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Document validation failed |
| `NOT_FOUND` | 404 | Document or resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate slug) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## 🔒 Security & Rate Limiting

### Authentication Requirements

**Public Endpoints** (no auth required):
- `GET /api/documents/:collection` (published documents only)
- `GET /api/documents/:collection/:id` (published documents only)
- `GET /api/media/:id` (public media only)

**Authenticated Endpoints** (API token or session required):
- All `POST`, `PUT`, `DELETE` operations
- Access to draft documents
- Media upload
- Schema introspection

### Rate Limiting

Default rate limits:
- **Authenticated requests**: 1000 requests per hour
- **Unauthenticated requests**: 100 requests per hour
- **Media uploads**: 50 uploads per hour

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

## 🎛️ Configuration

### API Configuration
```typescript
// trokky.config.ts
export default defineConfig({
  api: {
    basePath: '/api',
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true
    },
    rateLimit: {
      authenticated: 1000, // requests per hour
      unauthenticated: 100
    },
    graphql: {
      endpoint: '/api/graphql',
      playground: process.env.NODE_ENV === 'development',
      introspection: true
    }
  }
})
```

This API specification ensures Trokky v2 provides a powerful, flexible, and developer-friendly interface for content management while maintaining security and performance.