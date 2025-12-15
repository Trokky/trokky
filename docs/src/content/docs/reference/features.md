---
title: Features Configuration
description: Optional features that enhance Trokky content management
---

Trokky provides optional features that enhance content management. These features can be configured in your `trokky.config.ts` file under the `features` key.

## Auto-Thumbnail

Automatically injects a thumbnail/featured image field into document schemas.

### Configuration

```typescript
// trokky.config.ts
export default {
  // ... other config

  features: {
    autoThumbnail: {
      enabled: true,              // Enable auto-thumbnail injection (default: true)
      fieldName: '_thumbnail',    // Field name to use (default: '_thumbnail')
      skipSingletons: true,       // Skip singleton documents (default: true)
      skipSchemas: [],            // Array of schema names to skip (default: [])
      maxFileSize: 10 * 1024 * 1024, // Max file size in bytes (default: 10MB)
      allowedTypes: [             // Allowed MIME types (default: common image types)
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
      ]
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the auto-thumbnail feature globally |
| `fieldName` | `string` | `'_thumbnail'` | The field name used for the injected thumbnail field |
| `skipSingletons` | `boolean` | `true` | Skip injecting thumbnails into singleton documents |
| `skipSchemas` | `string[]` | `[]` | Array of schema names to skip (e.g., `['settings', 'navigation']`) |
| `maxFileSize` | `number` | `10485760` (10MB) | Maximum file size allowed for thumbnail uploads |
| `allowedTypes` | `string[]` | `['image/jpeg', 'image/png', 'image/webp', 'image/gif']` | Allowed MIME types for thumbnails |

### Behavior

1. **Automatic injection**: When enabled, a media field is automatically added to document schemas after the `title`, `name`, or `slug` field for better UX.

2. **Skip logic**: The thumbnail field is NOT injected if:
   - The feature is disabled (`enabled: false`)
   - The schema name is in the `skipSchemas` array
   - The schema is a singleton and `skipSingletons` is `true`
   - The schema already has a field named `_thumbnail`, `thumbnail`, `featuredImage`, `featured_image`, or `image`

3. **Generated field**: The injected field has the following properties:
   - Type: `media`
   - Title: "Featured Image"
   - Description: "Main image representing this content"
   - Required: `false`
   - Options: Upload, browse, drag-drop enabled; variant selector, metadata, and preview shown; alt text required

### Examples

#### Disable for specific schemas

```typescript
features: {
  autoThumbnail: {
    enabled: true,
    skipSchemas: ['navigation', 'settings', 'homepage']
  }
}
```

#### Disable globally

```typescript
features: {
  autoThumbnail: {
    enabled: false
  }
}
```

#### Include singletons

```typescript
features: {
  autoThumbnail: {
    enabled: true,
    skipSingletons: false  // Will add thumbnails to singletons too
  }
}
```

#### Custom field name

```typescript
features: {
  autoThumbnail: {
    enabled: true,
    fieldName: 'coverImage'  // Use 'coverImage' instead of '_thumbnail'
  }
}
```

## Auto-Slug

Automatically generates URL-friendly slugs from source fields.

### Configuration

```typescript
features: {
  autoSlug: {
    enabled: true,           // Enable auto-slug generation (default: varies)
    sourceFields: ['title', 'name'], // Fields to generate slug from
    unique: true             // Ensure slugs are unique
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | varies | Enable or disable auto-slug generation |
| `sourceFields` | `string[]` | `['title', 'name']` | Fields to use as source for slug generation |
| `unique` | `boolean` | `true` | Ensure generated slugs are unique across documents |

### Behavior

1. **Source field detection**: The system looks for the first available source field in order

2. **Slug generation**: Converts the source value to a URL-friendly format:
   - Converts to lowercase
   - Replaces spaces with hyphens
   - Removes special characters
   - Truncates to max length

3. **Uniqueness**: If `unique: true`, appends a number suffix for duplicates (`my-post`, `my-post-1`, `my-post-2`)

### Examples

#### Basic usage

```typescript
features: {
  autoSlug: {
    enabled: true,
    sourceFields: ['title']
  }
}
```

#### Multiple source fields

```typescript
features: {
  autoSlug: {
    enabled: true,
    sourceFields: ['title', 'name', 'heading']  // Falls back through list
  }
}
```

#### Disable uniqueness check

```typescript
features: {
  autoSlug: {
    enabled: true,
    unique: false  // Allow duplicate slugs (useful for multi-tenant)
  }
}
```

## Combining Features

Features can be combined:

```typescript
features: {
  autoThumbnail: {
    enabled: true,
    skipSchemas: ['settings']
  },
  autoSlug: {
    enabled: true,
    sourceFields: ['title']
  }
}
```

## Disabling All Features

To disable all optional features:

```typescript
features: {
  autoThumbnail: { enabled: false },
  autoSlug: { enabled: false }
}
```

Or simply omit the `features` key to use defaults.
