# Production Build Pipeline for Trokky Cloudflare Workers

This guide explains how to build and deploy Trokky with the Studio integrated into a Cloudflare Worker for production use.

## 🎯 Production Architecture

In production, instead of running Studio and Worker separately, you serve everything from a single Cloudflare Worker:

```
┌─────────────────────────────────────────┐
│         Cloudflare Worker               │
│  https://your-app.workers.dev           │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Trokky API  │  │ Studio (Static) │   │
│  │ /api/*      │  │ /studio         │   │
│  │             │  │                 │   │
│  │ - Auth      │  │ - Built React   │   │
│  │ - CRUD      │  │ - Bundled CSS   │   │
│  │ - Media     │  │ - Optimized JS  │   │
│  └─────────────┘  └─────────────────┘   │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │        Storage Layer                │ │
│  │  ┌─────────────┐ ┌─────────────────┐│ │
│  │  │ D1 Database │ │ R2 Media Bucket ││ │
│  │  └─────────────┘ └─────────────────┘│ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 🚀 Build Process

### 1. Development vs Production

**Development** (what we built earlier):
```bash
npm run dev:worker
# - Worker on :8787
# - Studio on :5173 (separate Vite dev server)
# - CORS needed for cross-origin requests
```

**Production** (what this pipeline creates):
```bash
npm run build:production
# - Studio built as static files
# - Studio embedded/bundled with Worker
# - Everything served from same origin
# - No CORS issues
```

### 2. Build Pipeline Steps

The `build-production.js` script performs these steps:

#### Step 1: Build Studio
```bash
cd packages/studio
npm run build
# Creates optimized React build in dist/
```

#### Step 2: Read Built Assets
```javascript
// Reads all built files:
// - index.html (main HTML file)
// - assets/*.js (JavaScript bundles)
// - assets/*.css (CSS bundles)
```

#### Step 3: Generate Production Worker
```javascript
// Creates worker.production.ts with:
// - Embedded Studio HTML
// - Production CORS configuration
// - Optimized caching
// - Asset serving routes
```

#### Step 4: Create Deployment Instructions
```markdown
# Generates DEPLOYMENT.md with:
# - Secret configuration commands
# - Domain setup instructions
# - Performance optimization tips
```

## 🔧 Asset Serving Strategies

### Option 1: Embed Small Assets
```javascript
// Embed CSS and small JS files directly in worker
const STUDIO_ASSETS = {
  'index.html': `<!DOCTYPE html>...`,
  'main.css': `.app { ... }`,
  'main.js': `(function() { ... })()`
}
```

**Pros**: Single file deployment, fast loading
**Cons**: Large worker bundle, 1MB worker size limit

### Option 2: Serve from R2/CDN
```javascript
// Store assets in R2, serve with proper headers
app.get('/assets/*', async (c) => {
  const assetPath = c.req.path.replace('/assets/', '')
  const asset = await env.R2.get(`studio-assets/${assetPath}`)
  return new Response(asset.body, {
    headers: {
      'Content-Type': getContentType(assetPath),
      'Cache-Control': 'public, max-age=31536000'
    }
  })
})
```

**Pros**: Unlimited asset size, CDN caching
**Cons**: Additional R2 requests, more complex setup

### Option 3: External CDN
```html
<!-- Load React/framework from CDN -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<!-- Load your app bundle from R2/CDN -->
<script src="/assets/your-app.js"></script>
```

**Pros**: Fast CDN delivery, smaller worker
**Cons**: External dependencies, network requests

## 📦 Usage Examples

### Basic Production Build
```bash
cd examples/demo-cloudflare

# Build Studio + generate production worker
npm run build:production

# Review generated files
ls -la worker.production.ts DEPLOYMENT.md

# Deploy to Cloudflare
npm run deploy:production
```

### Custom Build Configuration
```javascript
// Modify build-production.js for custom needs:

// 1. Custom asset embedding
const EMBED_ASSETS = ['main.css', 'vendor.js'] // Only embed critical assets

// 2. Custom CORS origins
corsOptions: {
  origin: process.env.PRODUCTION_DOMAINS?.split(',') || ['https://yourdomain.com']
}

// 3. Custom Studio configuration
window.TROKKY_CONFIG = {
  mode: 'production',
  apiUrl: '/api',
  branding: {
    title: 'Your CMS Name',
    logo: '/assets/your-logo.svg',
    theme: 'dark'
  }
}
```

### Advanced Asset Pipeline
```javascript
// For large applications, use a more sophisticated approach:

// 1. Build Studio with custom Vite config
// vite.config.production.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', '@heroicons/react']
        }
      }
    }
  }
})

// 2. Upload assets to R2 during build
async function uploadAssetsToR2(env) {
  const assets = await fs.readdir('dist/assets')
  for (const asset of assets) {
    const content = await fs.readFile(`dist/assets/${asset}`)
    await env.R2.put(`studio-assets/${asset}`, content)
  }
}

// 3. Generate asset manifest
const assetManifest = {
  'main.js': '/assets/main-abc123.js',
  'main.css': '/assets/main-def456.css'
}
```

## 🚀 Deployment Workflow

### 1. Development
```bash
# Work with hot reload
npm run dev:worker
```

### 2. Build for Production
```bash
# Generate production files
npm run build:production

# Review generated worker.production.ts
# Update CORS origins for your domain
# Test locally if needed
```

### 3. Configure Secrets
```bash
# Set production secrets
wrangler secret put TROKKY_JWT_SECRET
wrangler secret put TROKKY_ADMIN_EMAIL
wrangler secret put TROKKY_ADMIN_PASSWORD

# Optional: R2 credentials for advanced asset serving
wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY
```

### 4. Deploy
```bash
# Use production worker
cp worker.production.ts worker.ts

# Deploy to Cloudflare
wrangler deploy

# Or use the combined command
npm run deploy:production
```

### 5. Verify Deployment
```bash
# Test API
curl https://your-worker.workers.dev/api/health

# Test Studio
open https://your-worker.workers.dev/studio

# Test authentication
curl -X POST https://your-worker.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"credentials": {"username": "admin", "password": "your-password"}}'
```

## 🔍 Production Considerations

### Performance
- **Bundle size**: Keep worker under 1MB limit
- **Cold starts**: Cache initialized app instances
- **Asset caching**: Use proper Cache-Control headers
- **CDN**: Leverage Cloudflare's global network

### Security
- **CORS**: Use specific origins, not wildcards
- **Secrets**: Use Wrangler secrets, not environment variables
- **CSP**: Implement Content Security Policy headers
- **Rate limiting**: Enable built-in rate limiting

### Monitoring
- **Analytics**: Enable Cloudflare Analytics
- **Logging**: Use console.log for Cloudflare logs
- **Errors**: Set up error tracking
- **Usage**: Monitor D1 and R2 usage

### Scaling
- **Database**: D1 scales automatically
- **Storage**: R2 has no limits
- **Compute**: Workers scale to zero and up automatically
- **Global**: Deployed to 300+ edge locations

## 🛠️ Customization

### Custom Studio Build
```javascript
// packages/studio/vite.config.production.ts
export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.TROKKY_API_URL': '"/api"' // Same origin in production
  },
  build: {
    outDir: 'dist-production',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
```

### Custom Worker Template
```javascript
// Create your own production worker template
// examples/demo-cloudflare/templates/worker.production.template.ts

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Your custom production logic
    // - Custom routing
    // - Custom asset serving
    // - Custom caching strategies
  }
}
```

## 📚 Related Documentation

- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/)
- [R2 Storage Guide](https://developers.cloudflare.com/r2/)

---

This production build pipeline ensures your Trokky CMS can be deployed as a single, optimized Cloudflare Worker with the Studio interface integrated seamlessly.
