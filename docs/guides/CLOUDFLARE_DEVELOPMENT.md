# Cloudflare Workers + Studio Development Guide

This guide covers setting up concurrent development with Cloudflare Workers backend and Trokky Studio frontend, including proper CORS configuration and troubleshooting.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare account with D1 and R2 access

### 1. Setup Cloudflare Resources

```bash
# Navigate to demo directory
cd examples/demo-cloudflare

# Create D1 database
wrangler d1 create trokky-demo

# Create R2 bucket
wrangler r2 bucket create trokky-media

# Run setup script
npm run setup
```

### 2. Start Concurrent Development

From the **root directory**:
```bash
npm run dev:worker
```

Or from the **demo-cloudflare directory**:
```bash
npm run dev
```

This starts both:
- **Cloudflare Worker** on `http://localhost:8787`
- **Trokky Studio** on `http://localhost:5173` (or 5174 if 5173 is busy)

### 3. Access the Applications

- **API Endpoints**: `http://localhost:8787/api/*`
- **Studio Interface**: `http://localhost:5173`
- **Health Check**: `http://localhost:8787/api/health`

## 📋 Configuration Details

### Environment Variables

Create `.env` file in `examples/demo-cloudflare/`:

```bash
# Required for development
NODE_ENV=development
TROKKY_JWT_SECRET=your-super-secure-256-bit-secret-key

# Admin user (created automatically if not exists)
TROKKY_ADMIN_EMAIL=admin@cloudflare-demo.com
TROKKY_ADMIN_PASSWORD=YourSecurePassword123!

# Cloudflare configuration (for production)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_D1_DATABASE_NAME=trokky-demo
CLOUDFLARE_R2_BUCKET=trokky-media
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
```

### Package.json Scripts

The concurrent setup uses these scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:worker\" \"npm run dev:studio\" --names \"worker,studio\" --prefix-colors \"cyan,magenta\"",
    "dev:worker": "wrangler dev",
    "dev:studio": "cd ../../packages/studio && VITE_API_URL=http://localhost:8787 npm run dev",
    "dev:worker-only": "wrangler dev"
  }
}
```

**Key Points:**
- `VITE_API_URL=http://localhost:8787` tells Studio where to find the API
- `concurrently` runs both services with colored output
- Worker runs on port 8787, Studio on port 5173

## 🔧 CORS Configuration

### The CORS Challenge

When running Studio and Worker on different ports, CORS (Cross-Origin Resource Sharing) must be properly configured. The key challenge is:

**❌ Invalid Configuration:**
```javascript
corsOptions: {
  origin: '*',           // Wildcard not allowed...
  credentials: true      // ...when credentials are enabled
}
```

**✅ Correct Configuration:**
```javascript
corsOptions: {
  origin: ['http://localhost:5173', 'http://localhost:5174'], // Specific origins
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}
```

### CORS Implementation

The CORS configuration is handled in `worker.ts`:

```typescript
const integration = new TrokkyHono({
  core,
  basePath: '/api', // Important: Studio expects /api prefix
  corsOptions: {
    origin: env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }
})
```

### Why This Works

1. **Specific Origins**: Browser security requires exact origin matching when credentials are involved
2. **Hono Middleware**: Uses Hono's built-in CORS middleware (not TrokkyRoutes CORS)
3. **Preflight Support**: Handles OPTIONS requests automatically
4. **Dynamic Origin**: Varies response based on request origin

## 🐛 Troubleshooting

### Common Issues

#### 1. CORS Errors in Browser

**Error**: `Access to fetch at 'http://localhost:8787/api/auth/login' from origin 'http://localhost:5173' has been blocked by CORS policy`

**Solutions**:
- Ensure worker is running on port 8787
- Check CORS origins include your Studio port
- Verify `credentials: true` is set
- Restart both services after CORS changes

#### 2. Studio Can't Connect to API

**Error**: `POST http://localhost:8787/api/auth/login net::ERR_CONNECTION_REFUSED`

**Solutions**:
- Check worker is running: `curl http://localhost:8787/api/health`
- Verify `VITE_API_URL=http://localhost:8787` in Studio startup
- Ensure `basePath: '/api'` in worker configuration

#### 3. Authentication Fails

**Error**: `{"success":false,"error":{"code":"INVALID_INPUT","message":"Login credentials are required"}}`

**Solutions**:
- Use correct payload format: `{"credentials": {"username": "admin", "password": "demo123"}}`
- Check admin user exists in database
- Verify JWT secret is set

#### 4. Build Warnings

**Warning**: `Using direct eval with a bundler is not recommended`

**Solution**: Fixed in core package by replacing `eval('require')('crypto')` with proper dynamic require detection.

#### 5. Package.json Exports Issues

**Error**: `Failed to resolve entry for package "@trokky/fields"`

**Solutions**:
- Ensure all packages have proper `exports` configuration
- Build packages: `npm run build`
- Check `"types"` comes before `"import"/"require"` in exports

### Testing CORS Manually

Test preflight request:
```bash
curl -X OPTIONS http://localhost:8787/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

Expected response headers:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
```

Test authentication:
```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"credentials": {"username": "admin", "password": "demo123"}}'
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Trokky Studio │    │ Cloudflare      │
│   (React/Vite)  │    │ Worker (Hono)   │
│                 │    │                 │
│ localhost:5173  │◄──►│ localhost:8787  │
│                 │    │                 │
│ - Admin UI      │    │ - REST API      │
│ - Authentication│    │ - D1 Database   │
│ - Content Mgmt  │    │ - R2 Storage    │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │ Cloudflare      │
│   (Development) │    │ Infrastructure  │
│                 │    │                 │
│ - CORS Requests │    │ - D1 Database   │
│ - JWT Tokens    │    │ - R2 Bucket     │
│ - Session Mgmt  │    │ - Edge Runtime  │
└─────────────────┘    └─────────────────┘
```

## 📝 Development Workflow

### 1. Start Development
```bash
npm run dev:worker  # From root directory
```

### 2. Make Changes
- **Backend changes**: Auto-reloaded by Wrangler
- **Studio changes**: Auto-reloaded by Vite
- **Package changes**: May require restart

### 3. Test Authentication
1. Open Studio: `http://localhost:5173`
2. Login with admin credentials
3. Verify JWT token in browser dev tools

### 4. API Development
- Health check: `GET /api/health`
- Authentication: `POST /api/auth/login`
- Collections: `GET /api/collections`
- Media: `POST /api/media/upload`

## 🚀 Production Deployment

### Environment Differences

**Development**:
- CORS origins: `['http://localhost:5173', 'http://localhost:5174']`
- JWT secret: Environment variable
- Admin user: Auto-created from env vars

**Production**:
- CORS origins: `['https://your-domain.com']`
- JWT secret: Wrangler secret
- Admin user: Created via secure process

### Deployment Commands

```bash
# Set production secrets
wrangler secret put TROKKY_JWT_SECRET
wrangler secret put TROKKY_ADMIN_EMAIL
wrangler secret put TROKKY_ADMIN_PASSWORD

# Deploy worker
wrangler deploy

# Deploy Studio (build and upload to your hosting)
cd packages/studio
npm run build
# Upload dist/ to your hosting provider
```

## 📚 Related Documentation

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Framework Guide](https://hono.dev/)
- [Trokky Core API Reference](../api/CORE_API.md)
- [Studio Configuration Guide](../studio/CONFIGURATION.md)

## 🤝 Contributing

When contributing to the Cloudflare integration:

1. **Test CORS thoroughly** - Different browsers, different origins
2. **Document environment variables** - Update `.env.example`
3. **Test both development and production** - Different CORS configs
4. **Update this guide** - Keep troubleshooting section current

## 📄 License

This documentation is part of Trokky v2, licensed under MIT License.
