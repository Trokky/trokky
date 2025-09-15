# @trokky/trokky

TypeScript-native client SDK for Trokky CMS with built-in HTTP client.

## Installation

```bash
npm install @trokky/trokky
```

## Usage

```typescript
import { TrokkyClient } from '@trokky/trokky'

const client = new TrokkyClient({
  baseUrl: 'http://localhost:3000/api',
  apiToken: 'your-api-token' // or authenticate with username/password
})

// Get documents
const articles = await client.queryDocuments('article')

// Create document
const newArticle = await client.createDocument('article', {
  title: 'Hello World',
  content: 'This is my first article'
})

// Upload media
const file = new File(['content'], 'image.jpg')
const media = await client.uploadFile(file)
```

## Features

- Built-in HTTP client (no external dependencies)
- TypeScript native with full type safety
- Authentication support (JWT + API tokens)
- Document CRUD operations
- Media upload and management
- Framework agnostic (Node.js, browsers, edge environments)
