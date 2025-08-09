# Trokky v2 🚀

> The Modern, Composable CMS for Developers

**Trokky v2** is a complete reimagination of content management - built for developers who want the power of Sanity with the simplicity of file-based workflows and the freedom to use any framework.

## 🎯 Vision

Create the **true alternative to Sanity** that developers actually want:
- **Local-first development** with Git-friendly workflows
- **Framework agnostic** - works with Express, Next.js, Cloudflare Workers, Hono, etc.
- **TypeScript native** with full type safety
- **Enterprise-grade security** with JWT authentication and role-based access control
- **Multi-environment crypto** - automatic adapter selection for maximum compatibility
- **Built-in user management** with audit logging and compliance features
- **Zero vendor lock-in** - own your data and deployment
- **Simple to start, powerful to scale**

## 🏗️ Architecture

### Composable Packages
```
packages/
├── core/           # CMS engine (schemas, validation, storage)
├── routes/         # Framework-agnostic API handlers  
├── studio/         # Modern React admin interface
├── client/         # Frontend SDK with type generation
├── integrations/   # Framework-specific adapters
│   ├── express/    #   Express.js integration
│   ├── nextjs/     #   Next.js App Router integration
│   ├── cloudflare/ #   Cloudflare Workers integration
│   └── hono/       #   Hono edge runtime integration
└── adapters/       # Storage backends
    ├── filesystem/ #   File-based storage (default)
    ├── cloudflare/ #   Cloudflare D1 + R2 storage
    └── s3/         #   AWS S3 + DynamoDB storage
```

### Developer Experience First
```typescript
// One config file to rule them all
export default {
  storage: 'filesystem', // or 'cloudflare', 's3', etc.
  schemas: './schemas',   // TypeScript schema definitions
  studio: {
    title: 'My CMS',
    structure: './studio.structure.ts'
  }
}
```

## 🚀 Quick Start

```bash
# Create new project
npx create-trokky@latest my-cms
cd my-cms

# Start development
npm run dev  # API + Studio + File watching

# Or integrate with existing framework
npm install @trokky/express
npm install @trokky/nextjs
npm install @trokky/cloudflare-workers
```

## 🔐 Authentication & User Management

Trokky v2 includes built-in user management with enterprise-grade security:

```typescript
// Setup admin user from environment variables
const core = new TrokkyCore(config, storage, {
  setupAdminFromEnv: true
})

await core.init() // Creates admin if TROKKY_ADMIN_EMAIL and TROKKY_ADMIN_PASSWORD are set
```

```bash
# .env file
TROKKY_ADMIN_EMAIL=admin@yoursite.com
TROKKY_ADMIN_PASSWORD=YourSecurePassword123!
TROKKY_JWT_SECRET=your-super-secure-256-bit-secret-key
```

**Authentication Flow:**
```typescript
// Login user
const authResult = await core.authenticateUser('username', 'password')
if (authResult) {
  const { user, token } = authResult
  // JWT token ready for API authentication
}

// Verify JWT token
const session = await core.verifyAuthToken(token)
if (session) {
  console.log(`User ${session.username} has role ${session.role}`)
}
```

**Built-in Features:**
- 🔒 **JWT authentication** with configurable expiration
- 👥 **Role-based access** (admin/editor/viewer)
- 🔐 **bcrypt password hashing** (Node.js) or **PBKDF2** (edge)
- 📊 **Audit logging** for compliance
- 🛡️ **Admin access control** with permission validation
- 🌐 **Multi-environment** crypto adapters (Node.js/Edge compatible)

## ✨ Key Features

### 🔐 **Enterprise Security & User Management**
- **JWT Authentication** with role-based access control (admin/editor/viewer)
- **Multi-environment crypto** adapters (Node.js, Web Crypto API, fallback)
- **Password security** with bcrypt hashing and strength validation
- **Admin access control** with automatic permission validation
- **Audit logging** for compliance and security monitoring
- **Environment-based admin setup** for development workflows

### 🎨 **Modern Studio Interface**
- Clean, intuitive admin UI built with React 18+
- User authentication and session management
- Real-time collaborative editing
- Media management with drag & drop
- Custom field types and layouts

### 🔧 **Framework Freedom**
- Use with any HTTP framework or serverless platform
- Framework-agnostic route handlers
- Deploy anywhere - Vercel, Netlify, Cloudflare, AWS, etc.
- **Edge runtime compatible** with automatic crypto adapter selection

### 📝 **TypeScript Native**
- Schemas defined in TypeScript
- Auto-generated types for frontend
- Full type safety from backend to frontend
- Runtime validation matching compile-time types

### 💾 **Flexible Storage**
- Start with files (Git-friendly)
- Scale to cloud storage when needed
- Migrate between storage types seamlessly

### 🌐 **Both REST & GraphQL**
- Auto-generated REST endpoints
- Auto-generated GraphQL schema
- Same data, multiple access patterns

## 🎯 Migration from Sanity

Built-in migration tools to switch from Sanity:

```bash
# One command migration
npx trokky migrate --from sanity \
  --project-id abc123 \
  --dataset production \
  --output ./my-trokky-project
```

## 🐛 Development & Debugging

### Studio Logger Control

Trokky v2 includes a comprehensive logging system for development and debugging. You can control log verbosity in the browser console:

```javascript
// Control log levels (most to least verbose)
window.TrokkyLogger.setLevel('debug')  // Shows everything
window.TrokkyLogger.setLevel('info')   // Shows info, warnings, errors
window.TrokkyLogger.setLevel('warn')   // Shows warnings and errors (default)
window.TrokkyLogger.setLevel('error')  // Shows errors only

// Disable/enable all logging
window.TrokkyLogger.disable()
window.TrokkyLogger.enable()

// Check current level
window.TrokkyLogger.getLevel()
```

**Default Behavior:**
- **Development**: `warn` level (warnings and errors only)
- **Production**: `error` level (errors only)
- Settings persist across page reloads in development

## 🌐 Edge Runtime Notes (Cloudflare Workers)

- Crypto: Core auto-detects Web Crypto and uses an edge-safe adapter. No need to install `bcrypt` or `jsonwebtoken` on Workers.
- Image processing: Set `media.processor` to `'none'` (or a cloud image service) on Workers; `sharp` is Node-only and optional.
- Storage: Use split adapters for Cloudflare — D1 for data (`@trokky/adapter-cloudflare-d1`) and R2 for media (`@trokky/adapter-cloudflare-r2`).
- Responses: Media endpoints return `Uint8Array` bodies, compatible with Workers and Node.
- Env access: Avoid direct unguarded `process.env` usage in edge code; core guards its env reads for secrets and mode.

## 📚 Documentation

- [**Project Specification**](./docs/specs/PROJECT_SPEC.md) - Detailed project overview
- [**Architecture Guide**](./docs/specs/ARCHITECTURE.md) - System design and patterns
- [**API Specification**](./docs/specs/API_SPEC.md) - Complete API reference
- [**Migration Guide**](./docs/specs/MIGRATION_FROM_SANITY.md) - Move from Sanity to Trokky

## 🛠️ Development Status

**Current Phase: Studio & Client Development** (Phase 2) - **AHEAD OF SCHEDULE** 🚀

### ✅ **Completed Packages** (Production Ready)

**`@trokky/core` v0.1.0** - The foundational CMS engine
- ✅ **Schema Management**: TypeScript-native schema registry with Zod validation
- ✅ **User Management**: Complete authentication system with role-based access control
- ✅ **Security-First**: Enterprise-grade crypto adapters, JWT authentication, bcrypt password hashing
- ✅ **Multi-Environment Crypto**: Automatic adapter selection (Node.js, Web Crypto API, fallback)
- ✅ **Storage Interface**: Type-safe adapter pattern for pluggable storage backends
- ✅ **Audit Logging**: Built-in security event tracking and compliance logging
- ✅ **Test Coverage**: 173 passing tests covering all functionality

**`@trokky/adapter-filesystem` v0.1.0** - Git-friendly file storage
- ✅ **Local Development**: File-based storage perfect for Git workflows
- ✅ **Security Hardened**: Path traversal protection, atomic writes, extension validation
- ✅ **User Storage**: Complete user management with secure file-based storage
- ✅ **Test Coverage**: 40 passing tests including security and edge cases

**`@trokky/routes` v0.1.0** - Framework-agnostic HTTP route handlers
- ✅ **Complete REST API**: Full CRUD operations for documents, media, and users
- ✅ **User Management API**: Login, logout, user creation, role management, token validation
- ✅ **JWT Authentication**: Secure token-based authentication with role-based access control
- ✅ **Admin Protection**: Automatic admin access validation for user management operations
- ✅ **Enterprise Security**: Authentication, path traversal protection, input validation
- ✅ **Test Coverage**: 51 passing tests including 16 security-focused tests

**`@trokky/express` v0.1.0** - Production-ready Express.js integration
- ✅ **Express Middleware**: Complete Express.js integration with authentication support
- ✅ **File Upload Handling**: Multer integration for secure media uploads
- ✅ **CORS Configuration**: Automatic CORS setup with security defaults
- ✅ **Error Handling**: Express-specific error handling and response formatting
- ✅ **Type Safety**: Full TypeScript support with Express request/response types
- ✅ **Production Ready**: Comprehensive middleware stack for production deployment
- ✅ **Test Coverage**: 37 passing tests covering all integration scenarios

### 🚧 **In Progress**
- [ ] Modern Studio UI (`@trokky/studio`) - **NEXT PRIORITY**
- [ ] Client SDK (`@trokky/client`)

### 🎯 **Major Achievements**
- **Enterprise-grade security** implemented with comprehensive authentication system
- **Multi-environment compatibility** with automatic crypto adapter selection
- **Express.js integration** complete with production-ready middleware
- **100% test pass rate** across all packages (301+ total tests)
- **Production-ready** core packages with full documentation

## 🤝 Contributing

This is a complete rewrite focused on simplicity and developer experience. See our [Development Guide](./docs/guides/DEVELOPMENT.md) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Trokky v2** - Building the CMS developers actually want to use.
