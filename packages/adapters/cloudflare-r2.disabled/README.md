# @trokky/adapter-cloudflare-r2

Cloudflare R2 media storage adapter for Trokky CMS. This adapter provides object storage for media files, image variants, and file management, optimized for edge runtime on Cloudflare Workers.

## Features

- ✅ **Full MediaStorageAdapter implementation**
- ✅ **Edge runtime optimized** - Works in Cloudflare Workers
- ✅ **Object storage** with Cloudflare R2
- ✅ **Image variant support** - Thumbnails, previews, optimized formats
- ✅ **Public URL generation** - Custom domain support
- ✅ **Metadata management** - Rich file metadata storage
- ✅ **TypeScript native** with full type safety

## Installation

```bash
npm install @trokky/adapter-cloudflare-r2
```

## Quick Start

### 1. Basic Usage

```typescript
import { CloudflareR2Adapter } from '@trokky/adapter-cloudflare-r2'

// In Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const mediaAdapter = new CloudflareR2Adapter({
      bucket: env.R2_BUCKET, // R2 binding
      keyPrefix: 'media/',
      cacheControl: 'public, max-age=31536000'
    })

    // Use with Trokky
    const trokky = new TrokkyCore(config, {
      data: dataAdapter,
      media: mediaAdapter
    })

    // ... handle request
  }
}
```

### 2. With TrokkyExpress

```typescript
import { TrokkyExpress } from '@trokky/express'

const trokky = await TrokkyExpress.create({
  schemas: blogSchemas,
  storage: {
    data: {
      adapter: 'cloudflare-d1',
      options: {
        database: env.DB
      }
    },
    media: {
      adapter: 'cloudflare-r2',
      options: {
        bucket: env.R2_BUCKET,
        keyPrefix: 'uploads/',
        maxFileSize: 10 * 1024 * 1024 // 10MB
      }
    }
  }
})
```

## Configuration Options

```typescript
interface CloudflareR2AdapterConfig {
  /** R2 bucket binding from Cloudflare Workers environment */
  bucket?: R2Bucket
  
  /** Bucket name (for direct configuration) */
  bucketName?: string
  
  /** Key prefix for organizing files (e.g., 'media/', 'uploads/') */
  keyPrefix?: string
  
  /** Enable debug logging */
  debug?: boolean
  
  /** Default cache control header for uploaded files */
  cacheControl?: string
  
  /** Custom metadata to add to all uploads */
  defaultMetadata?: Record<string, string>
  
  /** Enable automatic content type detection */
  autoContentType?: boolean
  
  /** Maximum file size allowed (in bytes) */
  maxFileSize?: number
}
```

## Features

### File Upload and Management

```typescript
const adapter = new CloudflareR2Adapter({
  bucket: env.R2_BUCKET,
  keyPrefix: 'media/',
  maxFileSize: 50 * 1024 * 1024 // 50MB limit
})

// Upload file
const mediaFile = await adapter.uploadFile(file, {
  filename: 'image.jpg',
  contentType: 'image/jpeg',
  id: 'custom-id'
})

// Get file metadata
const file = await adapter.getFile('file-id')

// Get file content
const content = await adapter.getFileContent('file-id')

// Update metadata
await adapter.updateFile('file-id', {
  description: 'Updated description',
  tags: ['photo', 'landscape']
})
```

### Image Variants

```typescript
// Save processed image variants
await adapter.saveVariantFile('image-id', 'thumbnail', thumbnailBuffer, 'webp')
await adapter.saveVariantFile('image-id', 'preview', previewBuffer, 'jpeg')

// Retrieve variant content
const thumbnailContent = await adapter.getVariantContent('image-id', 'thumbnail')

// Get public URLs for variants
const thumbnailUrl = await adapter.getVariantUrl('image-id', 'thumbnail')
```

### File Listing and Search

```typescript
// List all media files
const allFiles = await adapter.listMedia({
  limit: 50,
  contentType: 'image'
})

// Filter by content type
const images = await adapter.listMedia({
  limit: 100,
  contentType: 'image/'
})

// Check file existence
const exists = await adapter.fileExists('file-id')

// Get file size
const size = await adapter.getFileSize('file-id')
```

## Deployment

### 1. Create R2 Bucket

```bash
wrangler r2 bucket create trokky-media
```

### 2. Update wrangler.toml

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "trokky-media"
```

### 3. Configure Custom Domain (Optional)

For public file access, configure a custom domain in Cloudflare dashboard:

1. Go to R2 → Manage R2 API tokens
2. Add custom domain for your bucket
3. Update adapter URLs to use your domain

```typescript
const adapter = new CloudflareR2Adapter({
  bucket: env.R2_BUCKET,
  // Custom domain will be used for public URLs
})
```

### 4. Deploy

```bash
wrangler deploy
```

## Local Development

Use Wrangler for local R2 development:

```bash
# Start local development with R2 emulation
wrangler dev --local --persist

# Test R2 operations
wrangler r2 object list trokky-media --local
```

## Advanced Usage

### Custom Metadata

```typescript
const adapter = new CloudflareR2Adapter({
  bucket: env.R2_BUCKET,
  defaultMetadata: {
    project: 'my-website',
    environment: 'production'
  }
})

// Upload with custom metadata
await adapter.uploadFile(file, {
  filename: 'document.pdf',
  contentType: 'application/pdf',
  metadata: {
    category: 'legal',
    confidential: 'true',
    expiresAt: '2024-12-31'
  }
})
```

### Content Type Detection

```typescript
const adapter = new CloudflareR2Adapter({
  bucket: env.R2_BUCKET,
  autoContentType: true // Automatically detect content type from filename
})
```

### File Size Limits

```typescript
const adapter = new CloudflareR2Adapter({
  bucket: env.R2_BUCKET,
  maxFileSize: 100 * 1024 * 1024 // 100MB limit
})
```

## Performance

The adapter is optimized for edge runtime:

- **Minimal dependencies** - Works in Workers restricted environment
- **Streaming uploads** - Efficient memory usage for large files
- **Variant caching** - Aggressive caching for processed images
- **CDN integration** - Built-in Cloudflare CDN support

## Limitations

- **R2 limits** - 5TB per file maximum
- **Custom domains** - Required for direct public access to files
- **Eventual consistency** - R2 operations may have slight delays

## Security

- **Input validation** - All file names and metadata validated
- **Content type checking** - Configurable allowed file types
- **Path traversal protection** - Prevents directory traversal attacks
- **Size limits** - Configurable maximum file sizes

## License

MIT