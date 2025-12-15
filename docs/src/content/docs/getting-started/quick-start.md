---
title: Quick Start
description: Build your first Trokky-powered API in minutes
---

This guide walks you through creating a complete content API with Trokky in under 10 minutes.

## What We'll Build

A simple blog API with:
- Post and Author content types
- REST API endpoints
- Admin interface (Studio)
- File-based storage

## Step 1: Project Setup

Create a new directory and initialize:

```bash
mkdir my-trokky-project
cd my-trokky-project
npm init -y
npm pkg set type=module
```

Install dependencies:

```bash
npm install @trokky/core @trokky/express @trokky/adapter-filesystem @trokky/studio express
npm install -D typescript tsx @types/express @types/node
```

## Step 2: Define Your Schemas

Create `schemas.ts`:

```typescript
import { Schema } from '@trokky/core';

export const schemas: Schema[] = [
  {
    name: 'author',
    title: 'Author',
    fields: [
      {
        name: 'name',
        title: 'Name',
        type: 'string',
        required: true,
      },
      {
        name: 'email',
        title: 'Email',
        type: 'string',
        validation: { email: true },
      },
      {
        name: 'bio',
        title: 'Biography',
        type: 'text',
      },
    ],
  },
  {
    name: 'post',
    title: 'Blog Post',
    fields: [
      {
        name: 'title',
        title: 'Title',
        type: 'string',
        required: true,
      },
      {
        name: 'slug',
        title: 'Slug',
        type: 'slug',
        options: { source: 'title' },
      },
      {
        name: 'author',
        title: 'Author',
        type: 'reference',
        options: { to: 'author' },
      },
      {
        name: 'content',
        title: 'Content',
        type: 'richtext',
      },
      {
        name: 'publishedAt',
        title: 'Published Date',
        type: 'datetime',
      },
      {
        name: 'featured',
        title: 'Featured Post',
        type: 'boolean',
        default: false,
      },
    ],
  },
];
```

## Step 3: Create the Server

Create `server.ts`:

```typescript
import express from 'express';
import { TrokkyExpress } from '@trokky/express';
import { schemas } from './schemas.js';

const app = express();

// Initialize Trokky
const trokky = await TrokkyExpress.create({
  schemas,
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
  },
  security: {
    adminUser: {
      username: 'admin',
      password: 'demo123',
    },
  },
  studio: {
    enabled: true,
    branding: {
      title: 'My Blog CMS',
    },
  },
  server: {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true,
    },
  },
});

// Mount all Trokky routes
trokky.mount(app);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Studio available at http://localhost:${PORT}/studio`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
```

## Step 4: Run the Server

```bash
npx tsx server.ts
```

You should see:
```
Server running at http://localhost:3000
Studio available at http://localhost:3000/studio
API available at http://localhost:3000/api
```

## Step 5: Explore the Studio

Open http://localhost:3000/studio in your browser.

1. Log in with username `admin` and password `demo123`
2. You'll see your content types: Authors and Posts
3. Create an author
4. Create a blog post and link it to the author

## Step 6: Use the API

The REST API is now available at `/api`. Try these endpoints:

### List all posts

```bash
curl http://localhost:3000/api/documents/post
```

### Get a specific post

```bash
curl http://localhost:3000/api/documents/post/{id}
```

### Create a post (authenticated)

```bash
curl -X POST http://localhost:3000/api/documents/post \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "My First Post",
    "content": "Hello, Trokky!",
    "featured": true
  }'
```

## Project Structure

After running, your project looks like this:

```
my-trokky-project/
├── content/
│   ├── author/
│   │   └── {id}.json
│   └── post/
│       └── {id}.json
├── schemas.ts
├── server.ts
├── package.json
└── node_modules/
```

Content is stored as JSON files, making it easy to inspect, edit, and version control.

## What's Next?

You've built a complete content API! Here are some next steps:

- [Core Concepts](/getting-started/concepts/) - Understand how Trokky works
- [Defining Schemas](/guides/schemas/) - Create complex content structures
- [Studio Customization](/guides/studio/) - Customize the admin interface
- [Deployment](/guides/deployment/) - Deploy to production

## Full Example Code

Find the complete example in the [Trokky repository](https://github.com/Trokky/trokky/tree/main/examples/demo).
