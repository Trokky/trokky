---
title: "@trokky/nextjs"
description: Next.js App Router integration for Trokky
---

`@trokky/nextjs` provides integration for Next.js applications using the App Router, enabling you to add a headless CMS to your Next.js project.

## Installation

```bash
npm install @trokky/nextjs @trokky/core @trokky/adapter-filesystem
```

## Quick Start

### 1. Create API Route

```typescript
// app/api/[...trokky]/route.ts
import { TrokkyNextjs } from '@trokky/nextjs';

const trokky = TrokkyNextjs.create({
  schemas: [
    {
      name: 'post',
      title: 'Post',
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'richtext' },
      ],
    },
  ],
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
  },
  security: {
    jwtSecret: process.env.TROKKY_JWT_SECRET!,
    adminUser: {
      username: process.env.TROKKY_ADMIN_USERNAME!,
      password: process.env.TROKKY_ADMIN_PASSWORD!,
    },
  },
});

export const { GET, POST, PUT, PATCH, DELETE } = trokky.handlers();
```

### 2. Add Environment Variables

```bash
# .env.local
TROKKY_JWT_SECRET=your-secret-key
TROKKY_ADMIN_USERNAME=admin
TROKKY_ADMIN_PASSWORD=your-password
```

### 3. Access the API

```
GET /api/documents/post
POST /api/documents/post
GET /api/documents/post/[id]
```

## Configuration

### Full Configuration

```typescript
const trokky = TrokkyNextjs.create({
  // Schemas
  schemas: [...],

  // Storage
  storage: {
    adapter: 's3',
    region: process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET,
    tableName: process.env.DYNAMODB_TABLE,
  },

  // Security
  security: {
    jwtSecret: process.env.TROKKY_JWT_SECRET,
    adminUser: {
      username: process.env.TROKKY_ADMIN_USERNAME,
      password: process.env.TROKKY_ADMIN_PASSWORD,
    },
  },

  // Media
  media: {
    processor: 'sharp',
    variants: [
      { name: 'thumb', width: 200, height: 200, fit: 'cover' },
    ],
  },

  // Base path (if not at /api)
  basePath: '/api',
});
```

## Route Structure

The catch-all route handles all Trokky endpoints:

```
app/api/[...trokky]/route.ts
```

This creates:
- `/api/documents/*` - Document CRUD
- `/api/media/*` - Media management
- `/api/auth/*` - Authentication
- `/api/config/*` - Configuration

## Data Fetching

### Server Components

```typescript
// app/posts/page.tsx
import { createClient } from '@trokky/client';

const client = createClient({
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
});

export default async function PostsPage() {
  const posts = await client.documents.list('post');

  return (
    <div>
      {posts.data.map(post => (
        <article key={post._id}>
          <h2>{post.title}</h2>
        </article>
      ))}
    </div>
  );
}
```

### With Caching

```typescript
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch(`${process.env.API_URL}/api/documents/post`, {
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  });
  return res.json();
}

export default async function PostsPage() {
  const { data: posts } = await getPosts();
  // ...
}
```

### Dynamic Routes

```typescript
// app/posts/[slug]/page.tsx
import { createClient } from '@trokky/client';
import { notFound } from 'next/navigation';

const client = createClient({ apiUrl: process.env.API_URL });

export async function generateStaticParams() {
  const posts = await client.documents.list('post');
  return posts.data.map(post => ({ slug: post.slug.current }));
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const posts = await client.documents.list('post', {
    filter: { 'slug.current': params.slug },
    limit: 1,
  });

  const post = posts.data[0];
  if (!post) notFound();

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  );
}
```

## Studio Integration

### Option 1: Separate Route

```typescript
// app/studio/[[...path]]/page.tsx
import { TrokkyStudio } from '@trokky/studio/nextjs';

export default function StudioPage() {
  return <TrokkyStudio apiUrl="/api" />;
}
```

### Option 2: External Studio

Run Studio as a separate application and point it to your Next.js API.

## Media Handling

### Upload Route

```typescript
// app/api/[...trokky]/route.ts
// Media uploads are handled automatically by the catch-all route
```

### Serving Media

For local storage, create a media route:

```typescript
// app/media/[...path]/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  const filePath = path.join(process.cwd(), 'uploads', ...params.path);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const file = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);

  return new NextResponse(file, {
    headers: {
      'Content-Type': `image/${ext}`,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
```

For S3 storage, media URLs point directly to S3/CloudFront.

## Authentication

### Protected Routes

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('trokky-token');

  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
```

### Login Page

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@trokky/client';

const client = createClient({ apiUrl: '/api' });

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const { token } = await client.auth.login(
        formData.get('username') as string,
        formData.get('password') as string
      );

      // Store token (cookie set by API)
      router.push('/admin');
    } catch (err) {
      setError('Invalid credentials');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="username" type="text" placeholder="Username" />
      <input name="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

## Deployment

### Vercel

```bash
# Install dependencies
npm install

# Build
npm run build

# Deploy
vercel deploy
```

Environment variables in Vercel dashboard:
- `TROKKY_JWT_SECRET`
- `TROKKY_ADMIN_USERNAME`
- `TROKKY_ADMIN_PASSWORD`
- AWS credentials (if using S3)

### Edge Runtime

For Edge Runtime compatibility:

```typescript
// app/api/[...trokky]/route.ts
export const runtime = 'edge';

import { TrokkyNextjs } from '@trokky/nextjs';

const trokky = TrokkyNextjs.create({
  // Use Cloudflare adapter for edge
  storage: {
    adapter: 'cloudflare',
    // ...
  },
});
```

## ISR (Incremental Static Regeneration)

```typescript
// app/posts/page.tsx
export const revalidate = 60; // Revalidate every 60 seconds

async function getPosts() {
  const client = createClient({ apiUrl: process.env.API_URL });
  return client.documents.list('post');
}

export default async function PostsPage() {
  const posts = await getPosts();
  // ...
}
```

### On-Demand Revalidation

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { secret, path, tag } = await request.json();

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (path) {
    revalidatePath(path);
  }
  if (tag) {
    revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: true });
}
```

Configure webhook in Trokky:

```typescript
webhooks: {
  endpoints: [
    {
      url: 'https://your-site.com/api/revalidate',
      events: ['document:created', 'document:updated', 'document:deleted'],
      secret: process.env.REVALIDATION_SECRET,
    },
  ],
}
```

## TypeScript

### Type Generation

```bash
npx trokky generate-types --api http://localhost:3000/api --output ./types/content.ts
```

### Usage

```typescript
import type { Post } from '@/types/content';

const posts = await client.documents.list<Post>('post');
```

## Next Steps

- [@trokky/client](/packages/client/) - Frontend SDK
- [Deployment Guide](/guides/deployment/) - Production deployment
- [Recipes](/recipes/nextjs-app-router/) - Next.js patterns
