---
title: Next.js App Router
description: Integrate Trokky with Next.js App Router
---

This recipe shows how to integrate Trokky with a Next.js application using the App Router.

## Project Setup

### Install Dependencies

```bash
npm install @trokky/core @trokky/nextjs @trokky/adapter-filesystem @trokky/client
```

### Project Structure

```
my-nextjs-app/
├── app/
│   ├── api/
│   │   └── [...trokky]/
│   │       └── route.ts
│   ├── blog/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── client.ts
│   └── schemas.ts
├── content/
└── types/
    └── content.ts
```

## Schemas

```typescript
// lib/schemas.ts
import { Schema } from '@trokky/core';

export const schemas: Schema[] = [
  {
    name: 'post',
    title: 'Blog Post',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'slug', type: 'slug', options: { source: 'title' } },
      { name: 'excerpt', type: 'text' },
      { name: 'content', type: 'richtext' },
      { name: 'featuredImage', type: 'media' },
      { name: 'publishedAt', type: 'datetime' },
      {
        name: 'status',
        type: 'select',
        default: 'draft',
        options: {
          list: [
            { value: 'draft', title: 'Draft' },
            { value: 'published', title: 'Published' },
          ],
        },
      },
    ],
  },
];
```

## API Route

```typescript
// app/api/[...trokky]/route.ts
import { TrokkyNextjs } from '@trokky/nextjs';
import { schemas } from '@/lib/schemas';

const trokky = TrokkyNextjs.create({
  schemas,
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

## Client Setup

```typescript
// lib/client.ts
import { createClient } from '@trokky/client';

export const client = createClient({
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
});

// Server-side client (with auth if needed)
export const serverClient = createClient({
  apiUrl: process.env.API_URL || 'http://localhost:3000/api',
  token: process.env.TROKKY_API_TOKEN,
});
```

## Blog List Page

```typescript
// app/blog/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { client } from '@/lib/client';

export const revalidate = 60; // Revalidate every minute

async function getPosts() {
  const posts = await client.documents.list('post', {
    filter: { status: 'published' },
    orderBy: 'publishedAt',
    order: 'desc',
    expand: ['featuredImage'],
  });
  return posts.data;
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article key={post._id} className="border rounded-lg overflow-hidden">
            {post.featuredImage && (
              <Image
                src={post.featuredImage.url}
                alt={post.featuredImage.alt || post.title}
                width={400}
                height={225}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <h2 className="text-xl font-semibold mb-2">
                <Link href={`/blog/${post.slug.current}`}>
                  {post.title}
                </Link>
              </h2>
              {post.excerpt && (
                <p className="text-gray-600">{post.excerpt}</p>
              )}
              <time className="text-sm text-gray-500">
                {new Date(post.publishedAt).toLocaleDateString()}
              </time>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
```

## Single Post Page

```typescript
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { client } from '@/lib/client';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

async function getPost(slug: string) {
  const posts = await client.documents.list('post', {
    filter: { 'slug.current': slug, status: 'published' },
    limit: 1,
  });
  return posts.data[0] || null;
}

export async function generateStaticParams() {
  const posts = await client.documents.list('post', {
    filter: { status: 'published' },
  });

  return posts.data.map((post) => ({
    slug: post.slug.current,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);

  if (!post) {
    return { title: 'Not Found' };
  }

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.ogImage?.url || post.featuredImage?.url,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      {post.featuredImage && (
        <Image
          src={post.featuredImage.url}
          alt={post.featuredImage.alt || post.title}
          width={800}
          height={450}
          className="w-full rounded-lg mb-8"
          priority
        />
      )}

      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

      <time className="text-gray-500 block mb-8">
        {new Date(post.publishedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </time>

      <div
        className="prose lg:prose-lg"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
```

## On-Demand Revalidation

### Revalidation API Route

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { secret, type, slug } = body;

  // Verify webhook secret
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  // Revalidate based on content type
  if (type === 'post') {
    revalidatePath('/blog');
    if (slug) {
      revalidatePath(`/blog/${slug}`);
    }
  }

  return NextResponse.json({ revalidated: true });
}
```

### Configure Webhook in Trokky

```typescript
webhooks: {
  endpoints: [
    {
      url: `${process.env.SITE_URL}/api/revalidate`,
      events: ['document:created', 'document:updated', 'document:deleted'],
      secret: process.env.REVALIDATION_SECRET,
      transform: (event) => ({
        secret: process.env.REVALIDATION_SECRET,
        type: event.document._type,
        slug: event.document.slug?.current,
      }),
    },
  ],
}
```

## Environment Variables

```bash
# .env.local
TROKKY_JWT_SECRET=your-secret-key
TROKKY_ADMIN_USERNAME=admin
TROKKY_ADMIN_PASSWORD=your-password
NEXT_PUBLIC_API_URL=http://localhost:3000/api
API_URL=http://localhost:3000/api
REVALIDATION_SECRET=your-revalidation-secret
SITE_URL=http://localhost:3000
```

## Type Generation

Generate TypeScript types from your schemas:

```bash
npx trokky generate-types --api http://localhost:3000/api --output ./types/content.ts
```

Use in components:

```typescript
import type { Post } from '@/types/content';

const posts = await client.documents.list<Post>('post');
```

## Next Steps

- [Next.js Integration Package](/packages/nextjs/)
- [Client SDK](/packages/client/)
- [Type Generation](/packages/client/#type-generation)
