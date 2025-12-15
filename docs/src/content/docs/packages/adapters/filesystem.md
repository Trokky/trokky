---
title: "Filesystem Adapter"
description: File-based storage adapter for local development and Git workflows
---

`@trokky/adapter-filesystem` stores content as JSON files on the local filesystem, making it ideal for development and Git-based content workflows.

## Installation

```bash
npm install @trokky/adapter-filesystem
```

## Usage

```typescript
import { FilesystemAdapter } from '@trokky/adapter-filesystem';

const storage = new FilesystemAdapter({
  contentDir: './content',
  mediaDir: './uploads',
});
```

### With TrokkyExpress

```typescript
const trokky = await TrokkyExpress.create({
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
    mediaDir: './uploads',
  },
  // ...
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contentDir` | `string` | `'./content'` | Directory for document JSON files |
| `mediaDir` | `string` | `'./uploads'` | Directory for media files |
| `pretty` | `boolean` | `true` | Pretty-print JSON (easier to read in Git) |
| `indexing` | `boolean` | `true` | Enable index cache for faster queries |

## File Structure

Documents are stored as JSON files organized by schema:

```
content/
├── post/
│   ├── abc123.json
│   ├── def456.json
│   └── ghi789.json
├── author/
│   ├── author-001.json
│   └── author-002.json
├── siteSettings/
│   └── singleton.json
└── _users/
    └── admin.json

uploads/
├── images/
│   ├── photo-abc123.jpg
│   ├── photo-abc123-thumb.webp
│   └── photo-abc123-medium.webp
└── files/
    └── document-def456.pdf
```

### Document File Example

```json
{
  "_id": "abc123",
  "_type": "post",
  "_createdAt": "2024-01-15T10:00:00.000Z",
  "_updatedAt": "2024-01-16T14:30:00.000Z",
  "title": "My First Post",
  "slug": {
    "current": "my-first-post"
  },
  "content": "Hello world!",
  "author": {
    "_type": "reference",
    "_ref": "author-001"
  },
  "status": "published"
}
```

## Git Integration

The filesystem adapter is designed for Git workflows:

### .gitignore

```gitignore
# Ignore cache and temporary files
content/.cache/
uploads/.tmp/

# Optionally ignore uploads in Git
# uploads/
```

### Version Control Content

With content as files, you can:
- Track content changes in Git
- Use pull requests for content review
- Roll back to previous versions
- Branch for content experiments

### Example Workflow

```bash
# Create a content branch
git checkout -b content/new-blog-post

# Make changes in Studio
# ...

# Commit content changes
git add content/
git commit -m "Add new blog post about Trokky"

# Create PR for review
gh pr create --title "New blog post" --body "Review the content"
```

## Caching

The adapter maintains an index cache for faster queries:

```
content/
└── .cache/
    └── index.json
```

### Cache Structure

```json
{
  "post": {
    "abc123": {
      "title": "My First Post",
      "_createdAt": "2024-01-15T10:00:00.000Z",
      "_updatedAt": "2024-01-16T14:30:00.000Z"
    }
  }
}
```

### Disable Caching

```typescript
const storage = new FilesystemAdapter({
  contentDir: './content',
  indexing: false,  // Disable cache
});
```

## API Reference

### Constructor

```typescript
new FilesystemAdapter(options: FilesystemAdapterOptions)
```

### Methods

#### `createDocument(collection, data)`

Creates a new document.

```typescript
const doc = await storage.createDocument('post', {
  title: 'New Post',
  content: 'Content here',
});
```

#### `getDocument(collection, id)`

Retrieves a document by ID.

```typescript
const doc = await storage.getDocument('post', 'abc123');
```

#### `updateDocument(collection, id, data)`

Updates an existing document.

```typescript
const doc = await storage.updateDocument('post', 'abc123', {
  title: 'Updated Title',
});
```

#### `deleteDocument(collection, id)`

Deletes a document.

```typescript
await storage.deleteDocument('post', 'abc123');
```

#### `listDocuments(collection, options)`

Lists documents with optional filtering.

```typescript
const docs = await storage.listDocuments('post', {
  limit: 10,
  offset: 0,
  orderBy: '_createdAt',
  order: 'desc',
});
```

#### `uploadMedia(file, metadata)`

Uploads a media file.

```typescript
const asset = await storage.uploadMedia(buffer, {
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
});
```

#### `getMedia(id)`

Retrieves media metadata.

```typescript
const asset = await storage.getMedia('media-abc123');
```

#### `deleteMedia(id)`

Deletes a media file and all variants.

```typescript
await storage.deleteMedia('media-abc123');
```

## Performance Considerations

### Suitable For

- Development environments
- Small to medium content volumes (hundreds of documents)
- Git-based workflows
- Static site generation
- Local-first applications

### Not Suitable For

- High-traffic production sites
- Large content volumes (thousands of documents)
- Multi-server deployments
- Real-time collaboration

### Optimization Tips

1. **Enable indexing** for faster list queries
2. **Use SSD storage** for better I/O performance
3. **Limit media variants** to reduce disk usage
4. **Archive old content** periodically

## Migration

### Export to JSON

```typescript
const storage = new FilesystemAdapter({ contentDir: './content' });

const schemas = ['post', 'author', 'category'];
const backup = {};

for (const schema of schemas) {
  backup[schema] = await storage.listDocuments(schema);
}

fs.writeFileSync('backup.json', JSON.stringify(backup, null, 2));
```

### Import from JSON

```typescript
const backup = JSON.parse(fs.readFileSync('backup.json', 'utf-8'));

for (const [schema, docs] of Object.entries(backup)) {
  for (const doc of docs) {
    await storage.createDocument(schema, doc);
  }
}
```

## Troubleshooting

### Permission Errors

```bash
# Ensure write permissions
chmod -R 755 content/
chmod -R 755 uploads/
```

### Cache Corruption

```bash
# Clear the cache
rm -rf content/.cache/
```

The cache will be rebuilt automatically on next query.

### File Locking Issues

If you see file locking errors on concurrent writes, consider:
- Using a database adapter for high-concurrency scenarios
- Implementing a queue for write operations

## Next Steps

- [S3 Adapter](/packages/adapters/s3/) - Cloud storage for production
- [Cloudflare Adapter](/packages/adapters/cloudflare/) - Edge storage
- [Storage Guide](/guides/storage-adapters/) - Choosing an adapter
