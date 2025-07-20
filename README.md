# Trokky v2 🚀

> The Modern, Composable CMS for Developers

**Trokky v2** is a complete reimagination of content management - built for developers who want the power of Sanity with the simplicity of file-based workflows and the freedom to use any framework.

## 🎯 Vision

Create the **true alternative to Sanity** that developers actually want:
- **Local-first development** with Git-friendly workflows
- **Framework agnostic** - works with Express, Next.js, Cloudflare Workers, Hono, etc.
- **TypeScript native** with full type safety
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

## ✨ Key Features

### 🎨 **Modern Studio Interface**
- Clean, intuitive admin UI built with React 18+
- Real-time collaborative editing
- Media management with drag & drop
- Custom field types and layouts

### 🔧 **Framework Freedom**
- Use with any HTTP framework or serverless platform
- Framework-agnostic route handlers
- Deploy anywhere - Vercel, Netlify, Cloudflare, AWS, etc.

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

## 📚 Documentation

- [**Project Specification**](./docs/specs/PROJECT_SPEC.md) - Detailed project overview
- [**Architecture Guide**](./docs/specs/ARCHITECTURE.md) - System design and patterns
- [**API Specification**](./docs/specs/API_SPEC.md) - Complete API reference
- [**Migration Guide**](./docs/specs/MIGRATION_FROM_SANITY.md) - Move from Sanity to Trokky

## 🛠️ Development Status

**Current Phase: Foundation & Specifications** (Week 1)

- [x] Project structure and specifications
- [ ] Core CMS engine (`@trokky/core`)
- [ ] Framework-agnostic routes (`@trokky/routes`)
- [ ] Express integration (`@trokky/express`)
- [ ] Modern Studio UI (`@trokky/studio`)
- [ ] Client SDK (`@trokky/client`)

## 🤝 Contributing

This is a complete rewrite focused on simplicity and developer experience. See our [Development Guide](./docs/guides/DEVELOPMENT.md) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Trokky v2** - Building the CMS developers actually want to use.