---
title: Media Handling
description: Upload, process, and serve media files with Trokky
---

Trokky provides a complete media management system for handling images, files, and other assets.

## Overview

The media system supports:

- Image uploads with automatic optimization
- Multiple image variants (thumbnails, responsive sizes)
- File uploads (PDFs, documents, etc.)
- Media library with search and filtering
- CDN-ready URL generation

## Quick Setup

### Basic Configuration

```typescript
const trokky = await TrokkyExpress.create({
  media: {
    uploadDir: './uploads',
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    allowedTypes: ['image/*', 'application/pdf'],
  },
  // ...
});
```

### With Image Processing

Install Sharp for image optimization:

```bash
npm install sharp
```

```typescript
const trokky = await TrokkyExpress.create({
  media: {
    uploadDir: './uploads',
    processor: 'sharp',
    variants: [
      { name: 'thumb', width: 200, height: 200, fit: 'cover' },
      { name: 'medium', width: 800 },
      { name: 'large', width: 1600 },
    ],
  },
  // ...
});
```

## Configuration Options

### Full Media Configuration

```typescript
const trokky = await TrokkyExpress.create({
  media: {
    // Storage location
    uploadDir: './uploads',

    // File limits
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    maxFiles: 10,                    // Per request

    // Allowed MIME types
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'video/mp4',
    ],

    // Image processing
    processor: 'sharp',
    quality: 80,                     // JPEG/WebP quality
    format: 'webp',                  // Convert images to format

    // Image variants
    variants: [
      { name: 'thumb', width: 200, height: 200, fit: 'cover' },
      { name: 'small', width: 400 },
      { name: 'medium', width: 800 },
      { name: 'large', width: 1600 },
      { name: 'og', width: 1200, height: 630, fit: 'cover' },
    ],

    // URL generation
    baseUrl: 'https://cdn.example.com',
    pathPrefix: '/media',

    // Metadata extraction
    extractMetadata: true,

    // Cleanup
    removeOriginal: false,           // Keep original file
    cleanupOrphans: true,            // Remove unused files
  },
  // ...
});
```

## Image Variants

### Variant Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Variant identifier |
| `width` | `number` | Maximum width in pixels |
| `height` | `number` | Maximum height in pixels |
| `fit` | `string` | Resize strategy: `cover`, `contain`, `fill`, `inside`, `outside` |
| `format` | `string` | Output format: `jpeg`, `png`, `webp`, `avif` |
| `quality` | `number` | Output quality (1-100) |

### Fit Modes

```typescript
variants: [
  // Crop to exact dimensions
  { name: 'square', width: 500, height: 500, fit: 'cover' },

  // Fit within dimensions (may have whitespace)
  { name: 'contain', width: 800, height: 600, fit: 'contain' },

  // Stretch to fill (distorts aspect ratio)
  { name: 'fill', width: 400, height: 300, fit: 'fill' },

  // Resize to fit inside, preserving aspect ratio
  { name: 'inside', width: 1200, height: 800, fit: 'inside' },
]
```

## API Endpoints

### Upload Media

```bash
POST /api/media
Content-Type: multipart/form-data

file: (binary)
alt: "Image description"
```

Response:

```json
{
  "_id": "media-abc123",
  "filename": "photo.jpg",
  "originalFilename": "IMG_1234.jpg",
  "mimeType": "image/jpeg",
  "size": 245678,
  "width": 1920,
  "height": 1080,
  "alt": "Image description",
  "variants": {
    "thumb": "/media/photo-abc123-thumb.webp",
    "medium": "/media/photo-abc123-medium.webp",
    "large": "/media/photo-abc123-large.webp"
  },
  "url": "/media/photo-abc123.jpg",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### List Media

```bash
GET /api/media?type=image&limit=20&offset=0
```

### Get Media

```bash
GET /api/media/{id}
```

### Update Media Metadata

```bash
PATCH /api/media/{id}
Content-Type: application/json

{
  "alt": "Updated description",
  "title": "Photo title"
}
```

### Delete Media

```bash
DELETE /api/media/{id}
```

## Using Media in Schemas

### Media Field

```typescript
{
  name: 'featuredImage',
  type: 'media',
  title: 'Featured Image',
  options: {
    accept: ['image/*'],          // Allowed types
    maxSize: 5 * 1024 * 1024,     // 5MB
    showVariants: true,           // Show variant selector
    showMetadata: true,           // Show metadata editor
    requireAlt: true,             // Require alt text
  },
}
```

### Document with Media

```json
{
  "_id": "post-abc123",
  "_type": "post",
  "title": "My Post",
  "featuredImage": {
    "_type": "media",
    "_ref": "media-xyz789",
    "alt": "Post cover image"
  }
}
```

### Fetching with Media

When querying documents, media references are expanded:

```bash
GET /api/documents/post/abc123?expand=featuredImage
```

```json
{
  "_id": "post-abc123",
  "title": "My Post",
  "featuredImage": {
    "_id": "media-xyz789",
    "url": "/media/photo-xyz789.jpg",
    "alt": "Post cover image",
    "variants": {
      "thumb": "/media/photo-xyz789-thumb.webp",
      "medium": "/media/photo-xyz789-medium.webp"
    }
  }
}
```

## Client SDK Usage

### Upload

```typescript
import { createClient } from '@trokky/client';

const client = createClient({ apiUrl: 'http://localhost:3000/api' });

// Upload file
const file = document.querySelector('input[type="file"]').files[0];
const media = await client.media.upload(file, {
  alt: 'Image description',
});

console.log(media.url);
console.log(media.variants.thumb);
```

### List and Filter

```typescript
// List all images
const images = await client.media.list({
  type: 'image',
  limit: 20,
});

// Search by filename
const results = await client.media.list({
  search: 'hero',
});
```

## Storage Integration

### Filesystem

Media stored in configured directory:

```
uploads/
├── images/
│   ├── photo-abc123.jpg           # Original
│   ├── photo-abc123-thumb.webp    # Variant
│   ├── photo-abc123-medium.webp   # Variant
│   └── photo-abc123-large.webp    # Variant
├── files/
│   └── document-def456.pdf
└── .metadata/
    ├── photo-abc123.json
    └── document-def456.json
```

### S3

```typescript
media: {
  storage: 's3',
  bucket: 'my-media-bucket',
  prefix: 'uploads/',
  cdnUrl: 'https://cdn.example.com',
}
```

### Cloudflare R2

```typescript
media: {
  storage: 'cloudflare',
  r2Bucket: env.R2_BUCKET,
  publicUrl: 'https://media.example.com',
}
```

## Performance Optimization

### Lazy Variant Generation

Generate variants on-demand instead of at upload:

```typescript
media: {
  lazyVariants: true,
  variantCacheTtl: 86400,  // 24 hours
}
```

### CDN Integration

```typescript
media: {
  baseUrl: 'https://cdn.example.com',

  // Custom URL transformation
  transformUrl: (path, variant) => {
    return `https://cdn.example.com/${variant}/${path}`;
  },
}
```

### Responsive Images

Generate `srcset` for responsive images:

```typescript
// In frontend
const srcset = Object.entries(media.variants)
  .map(([name, url]) => {
    const width = { thumb: 200, small: 400, medium: 800, large: 1600 }[name];
    return `${url} ${width}w`;
  })
  .join(', ');

// <img srcset="..." sizes="(max-width: 600px) 400px, 800px" />
```

## Studio Media Library

The Studio includes a built-in media library with:

- Grid/list view toggle
- Type filtering (images, documents, etc.)
- Search by filename
- Drag-and-drop upload
- Bulk selection and deletion
- Inline metadata editing

### Customizing the Library

```typescript
studio: {
  media: {
    defaultView: 'grid',
    itemsPerPage: 24,
    showUploadZone: true,
    allowBulkDelete: true,
  },
}
```

## Next Steps

- [Studio Customization](/guides/studio/) - Customize the admin interface
- [Deployment](/guides/deployment/) - Deploy to production
- [HTTP API Reference](/reference/http-api/) - Complete API documentation
