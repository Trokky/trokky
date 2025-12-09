# @trokky/express

Express.js integration for Trokky CMS. Provides Express middleware and routing for framework-agnostic Trokky routes.

## Installation

```bash
npm install @trokky/express @trokky/routes @trokky/core
```

## Quick Start

```javascript
import express from 'express'
import { TrokkyCore } from '@trokky/core'
import { TrokkyExpress } from '@trokky/express'

const app = express()
const cms = new TrokkyCore(config, adapter)

// Recommended: Use setupForMount to avoid path conflicts
const { integration, mountPath } = TrokkyExpress.setupForMount({
  core: cms,
  // basePath will be automatically set to '' to prevent double paths
}, '/api')

app.use(mountPath, integration.router)
```

## ⚠️ Common Pitfalls

### Avoid Double Path Mounting

**❌ Wrong - creates `/api/api/v1/*` paths:**
```javascript
const trokkyExpress = new TrokkyExpress({
  core: cms,
  basePath: '/api/v1'  // Don't do this when mounting
})
app.use('/api', integration.router)  // Results in /api/api/v1/*
```

**✅ Correct - creates `/api/*` paths:**
```javascript
const trokkyExpress = new TrokkyExpress({
  core: cms,
  basePath: ''  // Empty basePath when mounting
})
app.use('/api', integration.router)  // Results in /api/*
```

**✅ Alternative - use basePath without mounting:**
```javascript
const trokkyExpress = new TrokkyExpress({
  core: cms,
  basePath: '/api/v1'  // Full path when not mounting
})
app.use('/', integration.router)  // Results in /api/v1/*
```

## Configuration

### ExpressIntegrationConfig

```typescript
interface ExpressIntegrationConfig {
  core: TrokkyCore
  basePath?: string  // Default: '' (empty)
  corsOptions?: CorsOptions
  authentication?: AuthConfig
  fileUpload?: FileUploadConfig
}
```

### Best Practices

1. **Use empty `basePath` when mounting**: Let Express handle the path prefix
2. **Use `setupForMount()` helper**: Automatically handles configuration
3. **Test your routes**: Verify paths don't have unexpected prefixes
4. **Check the debug output**: TrokkyExpress logs all registered routes

## Using trokky.config.ts

For a cleaner setup, use `TrokkyExpress.create()` with a configuration file:

```typescript
// trokky.config.ts
import { defineConfig } from '@trokky/express'
import { blogSchemas } from './schemas'

export default defineConfig({
  schemas: blogSchemas,
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
      title: 'My CMS',
    },
  },
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr'],
    detectBrowserLanguage: true,
  },
})
```

```typescript
// server.ts
import express from 'express'
import { TrokkyExpress } from '@trokky/express'
import config from './trokky.config'

const app = express()
const trokky = await TrokkyExpress.create(config)

trokky.mount(app) // Auto-mounts API, Studio, and static routes

app.listen(3000)
```

### i18n Configuration

The `i18n` section configures internationalization for the Studio interface:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultLocale` | `string` | `'en'` | Default language |
| `supportedLocales` | `string[]` | `['en', 'fr']` | Supported languages |
| `fallbackLocale` | `string` | `'en'` | Fallback when translation missing |
| `detectBrowserLanguage` | `boolean` | `true` | Auto-detect browser language |
| `debug` | `boolean` | `false` | Enable debug logging |

See [@trokky/i18n](../../i18n/README.md) for more details on translations and hooks.

## API Reference

### TrokkyExpress.setupForMount()

Recommended method that prevents path conflicts:

```javascript
const { integration, mountPath } = TrokkyExpress.setupForMount({
  core: cms,
  corsOptions: { origin: 'http://localhost:3000' }
}, '/api/v1')

app.use(mountPath, integration.router)
```

### TrokkyExpress.setup()

Standard setup method:

```javascript
const integration = TrokkyExpress.setup({
  core: cms,
  basePath: '',  // Remember to use empty string when mounting
})

app.use('/api', integration.router)
```

## Debugging

Enable debug logging to see route registration:

```javascript
// TrokkyExpress automatically logs:
// 🔧 TrokkyExpress: Found 20 route definitions
// 🔧 TrokkyExpress: Registering GET /collections/:collection
// 🔧 TrokkyExpress: Registering POST /collections/:collection
```

## Examples

See `/examples/blog-demo/backend/` for a complete working example.