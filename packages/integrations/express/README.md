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