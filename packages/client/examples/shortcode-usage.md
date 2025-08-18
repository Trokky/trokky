# Shortcode Support in Trokky Client

The `@trokky/client` package now includes comprehensive support for resolving shortcodes created by the RichTextField. This enables portable content that works across different environments.

## Overview

When content is created in Trokky Studio using RichTextField, images are stored as environment-agnostic shortcodes:

```
[trokky-image id="media-123" variant="thumbnail" alt="Example image"]
```

The client can resolve these shortcodes to actual HTML for display in your applications.

## Basic Usage

### Using TrokkyClient

```typescript
import { TrokkyClient } from '@trokky/client';

const client = new TrokkyClient({
  baseUrl: 'http://localhost:3000/cms-api',
  // ... other config
});

// Content from your CMS with shortcodes
const content = '<p>Check this image:</p>[trokky-image id="media-123" variant="thumbnail" alt="Example"]<p>Amazing!</p>';

// Resolve shortcodes to HTML
const resolvedContent = client.resolveContent(content);
// Result: '<p>Check this image:</p><img src="http://localhost:3000/cms-api/media/media-123/variants/thumbnail" alt="Example"><p>Amazing!</p>'

// Check if content has shortcodes
if (client.hasShortcodes(content)) {
  console.log('Content contains shortcodes');
}

// Extract media dependencies
const mediaList = client.extractContentMedia(content);
console.log('Media in content:', mediaList);
// Result: [{ id: 'media-123', variant: 'thumbnail', alt: 'Example' }]

// Preload media for faster rendering
await client.preloadContentMedia(content);
```

### Using ShortcodeResolver Directly

```typescript
import { ShortcodeResolver, createMediaUrlResolver } from '@trokky/client';

const resolver = new ShortcodeResolver(httpClient, mediaHelper);

const resolvedContent = resolver.resolveContent(content);
```

### Using Individual Parser Functions

```typescript
import { 
  resolveShortcodes, 
  hasShortcodes, 
  extractImageShortcodes,
  createMediaUrlResolver 
} from '@trokky/client';

const mediaUrlResolver = createMediaUrlResolver(httpClient);

if (hasShortcodes(content)) {
  const resolved = resolveShortcodes(content, mediaUrlResolver);
  const mediaList = extractImageShortcodes(content);
}
```

## React Integration

### Using React Hooks

```tsx
import { TrokkyClient, React as TrokkyReact } from '@trokky/client';

function BlogPost({ content }: { content: string }) {
  const client = useTrokkyClient(); // Your client provider
  
  // Automatically resolve shortcodes
  const resolvedContent = TrokkyReact.useResolvedContent(client, content);
  
  // Check if content has shortcodes
  const hasShortcodes = TrokkyReact.useHasShortcodes(client, content);
  
  // Get media dependencies
  const mediaList = TrokkyReact.useContentMedia(client, content);
  
  return (
    <article>
      {hasShortcodes && <p>This content includes media</p>}
      <div dangerouslySetInnerHTML={{ __html: resolvedContent }} />
      <aside>
        Media count: {mediaList.length}
      </aside>
    </article>
  );
}
```

### Custom React Component

```tsx
import { TrokkyClient, React as TrokkyReact } from '@trokky/client';

interface ContentRendererProps {
  content: string;
  client: TrokkyClient;
  onMediaLoad?: (mediaList: any[]) => void;
}

function ContentRenderer({ content, client, onMediaLoad }: ContentRendererProps) {
  const resolvedContent = TrokkyReact.useResolvedContent(client, content);
  const mediaList = TrokkyReact.useContentMedia(client, content);
  
  // Notify parent of media dependencies
  React.useEffect(() => {
    if (onMediaLoad && mediaList.length > 0) {
      onMediaLoad(mediaList);
    }
  }, [mediaList, onMediaLoad]);
  
  // Preload media on mount
  React.useEffect(() => {
    client.preloadContentMedia(content);
  }, [client, content]);
  
  return <div dangerouslySetInnerHTML={{ __html: resolvedContent }} />;
}
```

## Advanced Usage

### Custom Media URL Resolution

```typescript
import { ShortcodeResolver } from '@trokky/client';

// Create resolver with custom URL generation
const resolver = new ShortcodeResolver(httpClient);

// Get the underlying URL resolver for customization
const urlResolver = resolver.getMediaUrlResolver();

// Or create a custom one
const customResolver = {
  getMediaUrl: (mediaId: string, variant?: string) => {
    // Custom logic for URL generation
    return `https://cdn.example.com/${mediaId}${variant ? `/${variant}` : ''}`;
  }
};
```

### Batch Content Processing

```typescript
async function processMultipleContents(contents: string[], client: TrokkyClient) {
  const results = await Promise.all(
    contents.map(async (content) => {
      const resolved = client.resolveContent(content);
      const media = client.extractContentMedia(content);
      
      // Preload media for this content
      await client.preloadContentMedia(content);
      
      return { resolved, media };
    })
  );
  
  return results;
}
```

### SSR/SSG Support

```typescript
// Server-side rendering
function getStaticProps({ params }) {
  const client = new TrokkyClient({ baseUrl: process.env.CMS_URL });
  
  const document = await client.getDocument('blogPost', params.id);
  const resolvedContent = client.resolveContent(document.data.content);
  
  return {
    props: {
      content: resolvedContent,
      // Pre-resolved content for immediate rendering
    }
  };
}
```

## Environment Configuration

Shortcodes automatically adapt to your environment:

```typescript
// Development
const devClient = new TrokkyClient({
  baseUrl: 'http://localhost:3000/cms-api'
});

// Production  
const prodClient = new TrokkyClient({
  baseUrl: 'https://api.yoursite.com/cms-api'
});

// Same content, different URLs resolved automatically
const content = '[trokky-image id="media-123" variant="thumbnail"]';

devClient.resolveContent(content);
// -> <img src="http://localhost:3000/cms-api/media/media-123/variants/thumbnail">

prodClient.resolveContent(content); 
// -> <img src="https://api.yoursite.com/cms-api/media/media-123/variants/thumbnail">
```

## Benefits

1. **Environment Portability**: Content works across dev, staging, and production
2. **Performance**: Built-in preloading and caching support
3. **Type Safety**: Full TypeScript support with type inference
4. **Framework Agnostic**: Works with React, Vue, vanilla JS, and server-side rendering
5. **Progressive Enhancement**: Graceful fallback for content without shortcodes

The shortcode system ensures your content remains portable while providing the flexibility to customize media URL generation for your specific deployment needs.