# MediaUrlGenerator Documentation

## Overview

MediaUrlGenerator is a server-side component that generates proper URLs for media assets based on your configuration. It supports multiple serving modes and handles the complexity of URL generation across different deployment scenarios.

## Why MediaUrlGenerator?

While the Studio's `apiClient.getMediaUrl()` can generate simple API-based URLs, MediaUrlGenerator provides:

1. **Multiple Serving Modes**: Switch between API-based (secure) and static file serving (fast)
2. **CDN Support**: Configure custom domains for media delivery
3. **Framework Awareness**: Adapts to Express, Next.js, Cloudflare Workers, etc.
4. **Auto-detection**: Automatically detects API mount paths and adjusts URLs
5. **Performance Optimization**: Enable static serving for public media

## Configuration

### Basic Setup (Express Integration)

```typescript
const trokky = await TrokkyExpress.create({
  media: {
    serving: {
      mode: 'api', // or 'static'
      staticBasePath: '/media', // for static mode
      customDomain: 'https://cdn.example.com' // optional CDN
    }
  }
})
```

## Serving Modes

### API Mode (Default)
- **Security**: Full authentication and authorization
- **URLs**: `/api/media/{id}/file`, `/api/media/{id}/variants/{variant}`
- **Use Case**: Private content, user-specific media, secure applications

```typescript
// Configuration
media: {
  serving: {
    mode: 'api'
  }
}

// Generated URLs
/api/media/abc123/file           // Original file
/api/media/abc123/variants/thumb // Thumbnail variant
```

### Static Mode
- **Performance**: Direct file serving via Express/nginx
- **URLs**: `/media/{id}/original.jpg`, `/media/{id}/thumb.jpg`
- **Use Case**: Public websites, blogs, marketing sites

```typescript
// Configuration
media: {
  serving: {
    mode: 'static',
    staticBasePath: '/media'
  }
}

// Generated URLs
/media/abc123/original.jpg  // Original file
/media/abc123/thumb.jpg     // Thumbnail variant
```

### CDN Mode
- **Scale**: Serve media from a CDN
- **URLs**: `https://cdn.example.com/media/{id}/{variant}`
- **Use Case**: High-traffic sites, global distribution

```typescript
// Configuration
media: {
  serving: {
    mode: 'static',
    staticBasePath: '/media',
    customDomain: 'https://cdn.example.com'
  }
}

// Generated URLs
https://cdn.example.com/media/abc123/original.jpg
https://cdn.example.com/media/abc123/thumb.jpg
```

## How It Works

### Server-Side (Express Integration)

1. **Configuration**: MediaUrlGenerator is created with your media config
2. **Global Registry**: Config is stored in `__TROKKY_STUDIO_CONFIG__`
3. **API Endpoint**: Served to Studio via `/api/config/studio`
4. **URL Generation**: Generates URLs based on serving mode

### Client-Side (Studio)

1. **Initial Load**: Studio uses `apiClient.getMediaUrl()` as fallback
2. **Config Fetch**: Loads MediaUrlGenerator config from API
3. **URL Generation**: Uses server's preferred URL pattern
4. **Fallback Chain**: MediaUrlGenerator → apiClient → direct URL

## Fallback Behavior

The Studio implements a robust fallback chain:

```typescript
// Priority order for URL generation
1. MediaUrlGenerator (server config)    // Best - knows serving mode
2. apiClient.getMediaUrl()              // Good - works for API mode
3. asset.url (direct URL)              // Fallback - if URL exists
```

This ensures media always works, even during:
- Initial page load (before config loads)
- Configuration errors
- Network issues

## Troubleshooting

### "MediaUrlGenerator not available" Error

This error occurs when the Studio tries to generate a URL before the config is loaded. With the latest fixes, this should no longer happen due to the fallback chain.

### Broken Image Previews

If images don't load in the Studio:

1. **Check Serving Mode**: Ensure your serving mode matches your setup
2. **Verify Paths**: Check that media files exist at the expected paths
3. **CORS Issues**: For CDN/static mode, ensure CORS headers are set
4. **Console Logs**: Check browser console for detailed error messages

### Static Mode Not Working

For static serving to work:

1. **File System**: Media must be stored on the file system
2. **Express Static**: Middleware must be configured
3. **Correct Paths**: staticBasePath must match your file structure

```typescript
// Express setup for static serving
app.use('/media', express.static(path.join(__dirname, 'content/media')))
```

## Best Practices

1. **Development**: Use API mode for simplicity
2. **Production**: Consider static mode for public media
3. **CDN**: Use customDomain for global distribution
4. **Security**: Keep sensitive media in API mode
5. **Performance**: Generate thumbnails on upload, not on request

## Migration Guide

### From API-only to Static Serving

1. Update configuration:
```typescript
media: {
  serving: {
    mode: 'static',
    staticBasePath: '/media'
  }
}
```

2. Add Express static middleware:
```typescript
app.use('/media', express.static('./content/media'))
```

3. Ensure media files are accessible at the static path

### Adding CDN Support

1. Upload media to CDN
2. Configure customDomain:
```typescript
media: {
  serving: {
    mode: 'static',
    customDomain: 'https://cdn.example.com'
  }
}
```

3. Set appropriate cache headers and CORS policies on CDN