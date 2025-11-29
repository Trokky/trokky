# Trokky v2 - API Specification

## 🔌 API Overview

Trokky v2 provides both **REST** and **GraphQL** APIs, automatically generated from your content schemas. This dual approach gives developers the flexibility to choose the best API pattern for their use case.

## 🗂️ REST API

### Base URL Structure
```
/api/documents/:collection     # Document operations
/api/media                     # Media operations
/api/users                     # User management operations (admin only)
/api/auth                      # Authentication operations
/api/graphql                   # GraphQL endpoint
/api/schemas                   # Schema introspection
/studio/*                      # Studio static files
```

### Authentication

Trokky v2 uses **JWT (JSON Web Token)** authentication with role-based access control.

#### JWT Token Authentication
```http
Authorization: Bearer <jwt_token>
```

#### User Roles & Permissions
- **admin**: Full access to all operations including user management
- **editor**: Can read, write, and upload media
- **viewer**: Read-only access to content

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

## 👥 User Management Operations

**Authentication Required**: Admin role or `manage_users` permission

### List Users
```http
GET /api/users
```

**Parameters:**
- `role` (string) - Filter by user role (admin, editor, viewer)
- `isActive` (boolean) - Filter by active status
- `limit` (number, default: 50)
- `offset` (number, default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_abc123",
        "username": "johndoe",
        "email": "john@example.com", 
        "firstName": "John",
        "lastName": "Doe",
        "role": "editor",
        "permissions": ["read", "write", "upload_media"],
        "isActive": true,
        "lastLoginAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "meta": {
      "total": 1,
      "limit": 50,
      "offset": 0
    }
  }
}
```

### Create User
```http
POST /api/users
```

**Request Body:**
```json
{
  "userData": {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe", 
    "role": "editor",
    "permissions": ["read", "write"],
    "isActive": true
  }
}
```

### Get User
```http
GET /api/users/:id
```

### Update User
```http
PUT /api/users/:id
```

### Delete User
```http
DELETE /api/users/:id
```

### Get User by Username
```http
GET /api/users/by-username/:username
```

### Get User by Email
```http  
GET /api/users/by-email/:email
```

## 🔐 Authentication Operations

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "credentials": {
    "username": "johndoe",
    "password": "SecurePassword123!"
  }
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "editor",
    "permissions": ["read", "write", "upload_media"]
  },
  "expiresAt": "2024-01-16T10:30:00Z"
}
```

### Logout
```http
POST /api/auth/logout
```

### Validate Token
```http
POST /api/auth/validate
```

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "message": "Token is valid",
  "session": {
    "userId": "user_abc123",
    "username": "johndoe",
    "role": "editor",
    "permissions": ["read", "write", "upload_media"],
    "loginAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-01-16T10:30:00Z"
  }
}
```

## 🔑 OAuth Authentication

Trokky supports OAuth 2.0 authentication with external providers. Currently supported: **Google**.

### OAuth Flow Overview

1. User clicks "Sign in with Google" in Studio
2. Studio redirects to provider's OAuth consent screen
3. User authenticates with provider
4. Provider redirects back to Studio with authorization code
5. Studio exchanges code for user authentication

**Important**: OAuth login requires the user to first have a Trokky account linked to that provider. Users must link their OAuth provider from User Preferences before using OAuth login.

### Get OAuth Status
```http
GET /api/auth/oauth/status
```

Returns which OAuth providers are configured and available.

**Response:**
```json
{
  "success": true,
  "data": {
    "providers": {
      "google": true,
      "github": false,
      "microsoft": false
    }
  }
}
```

### Initialize Google OAuth
```http
POST /api/auth/oauth/google/init
```

Generates the OAuth authorization URL for redirecting the user.

**Request Body:**
```json
{
  "state": "random-state-string-for-csrf-protection",
  "mode": "login"
}
```

**Parameters:**
- `state` (string, required) - Random string stored client-side to prevent CSRF
- `mode` (string, optional) - Either `"login"` or `"link"`. Default: `"login"`

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&state=...",
    "state": "random-state-string-for-csrf-protection"
  }
}
```

### Google OAuth Callback
```http
POST /api/auth/oauth/google/callback
```

Handles the OAuth callback after user authenticates with Google.

**Request Body:**
```json
{
  "code": "authorization-code-from-google",
  "state": "random-state-string-for-csrf-protection",
  "mode": "login"
}
```

**Parameters:**
- `code` (string, required) - Authorization code from OAuth provider
- `state` (string, required) - State parameter for CSRF verification
- `mode` (string, optional) - Either `"login"` or `"link"`. Default: `"login"`

**Response (login mode):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_abc123",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "editor"
    }
  }
}
```

**Response (link mode):**
```json
{
  "success": true,
  "data": {
    "message": "Google account linked successfully",
    "provider": {
      "provider": "google",
      "email": "john@gmail.com",
      "linkedAt": "2024-01-20T15:00:00Z"
    }
  }
}
```

### Unlink OAuth Provider
```http
DELETE /api/auth/oauth/google/unlink
```

**Authentication Required**: JWT token

Removes the linked OAuth provider from the user's account.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Google account unlinked successfully"
  }
}
```

**Error Response (if only auth method):**
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_UNLINK",
    "message": "Cannot unlink the only authentication method. Set a password first."
  }
}
```

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