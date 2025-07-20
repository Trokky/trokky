# Trokky v2 - Project Structure

## 📁 Directory Overview

```
trokky-v2/
├── packages/                    # Core monorepo packages
│   ├── core/                   # CMS engine and business logic
│   ├── routes/                 # Framework-agnostic API handlers
│   ├── studio/                 # React-based admin interface  
│   ├── client/                 # Frontend SDK and utilities
│   ├── integrations/           # Framework-specific adapters
│   │   ├── express/           #   Express.js integration
│   │   ├── nextjs/            #   Next.js App Router integration
│   │   ├── cloudflare-workers/ #   Cloudflare Workers integration
│   │   └── hono/              #   Hono edge runtime integration
│   └── adapters/              # Storage backend adapters
│       ├── filesystem/        #   File-based storage (default)
│       ├── cloudflare/        #   Cloudflare D1 + R2 storage
│       └── s3/                #   AWS S3 + DynamoDB storage
├── examples/                   # Example projects and templates
│   ├── blog-starter/          #   Simple blog with Trokky
│   ├── e-commerce/            #   E-commerce site example
│   └── portfolio/             #   Portfolio/agency site
├── docs/                      # Documentation and specifications
│   ├── specs/                 #   Technical specifications
│   │   ├── PROJECT_SPEC.md    #     Project overview and goals
│   │   ├── ARCHITECTURE.md    #     System architecture design  
│   │   ├── API_SPEC.md        #     REST and GraphQL API docs
│   │   └── MIGRATION_FROM_SANITY.md # Sanity migration guide
│   ├── guides/                #   User and developer guides
│   └── api/                   #   API reference documentation
├── tools/                     # Development and build tools
│   ├── build/                 #   Build scripts and configurations
│   ├── migration/             #   Migration tools and utilities
│   └── testing/               #   Testing utilities and fixtures
├── README.md                  # Project overview and quick start
└── PROJECT_STRUCTURE.md      # This file
```

## 🎯 Package Responsibilities

### Core Packages

**`@trokky/core`**
- Content management engine
- Schema validation and processing
- Document CRUD operations
- Storage adapter interface
- Business logic and rules

**`@trokky/routes`**
- Framework-agnostic HTTP handlers
- REST and GraphQL endpoint definitions
- Request/response processing
- Authentication and authorization
- Error handling and validation

**`@trokky/studio`**
- Modern React admin interface
- Document editing and management
- Media browser and uploader
- User and permission management
- Real-time collaborative features

**`@trokky/client`**
- Frontend SDK for consuming APIs
- TypeScript type generation
- Document model abstractions
- Authentication helpers
- Caching and optimization

### Integration Packages

**`@trokky/express`**
- Express.js middleware and routing
- Session management
- Static file serving
- Development server utilities

**`@trokky/nextjs`**
- Next.js App Router integration
- API route handlers
- Middleware configuration
- Server-side rendering support

**`@trokky/cloudflare-workers`**
- Cloudflare Workers compatibility
- Edge runtime optimizations
- D1 and R2 integration
- Environment configuration

**`@trokky/hono`**
- Hono framework integration
- Edge runtime compatibility
- Lightweight routing
- Performance optimizations

### Storage Adapters

**`@trokky/adapter-filesystem`**
- File-based storage (default)
- JSON document storage
- Local media file handling
- Git-friendly workflows

**`@trokky/adapter-cloudflare`**
- Cloudflare D1 database integration
- R2 bucket media storage
- Edge-optimized operations
- Global distribution support

**`@trokky/adapter-s3`**
- AWS S3 media storage
- DynamoDB document storage
- Multi-region support
- Enterprise-grade scalability

## 🛠️ Development Workflow

### Package Development Order

1. **Phase 1: Foundation**
   - `@trokky/core` - Core CMS engine
   - `@trokky/routes` - Framework-agnostic handlers
   - `@trokky/adapter-filesystem` - Default storage

2. **Phase 2: Integration**
   - `@trokky/express` - First framework integration
   - `blog-starter` example - Proof of concept

3. **Phase 3: Studio**
   - `@trokky/studio` - Admin interface
   - `@trokky/client` - Frontend SDK

4. **Phase 4: Ecosystem**
   - Additional framework integrations
   - Cloud storage adapters
   - Migration tools

### Monorepo Management

**Package Manager:** pnpm (for workspace support)
**Build Tool:** Rollup/Vite (for efficient bundling)
**Testing:** Vitest (for fast unit testing)
**Linting:** ESLint + Prettier (for code quality)

### Shared Dependencies

```json
{
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0", 
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "rollup": "^3.0.0",
    "typescript": "^5.0.0",
    "vitest": "^0.34.0"
  }
}
```

## 📋 Development Standards

### Code Organization

- **TypeScript-first** - All packages written in TypeScript
- **Functional approach** - Prefer pure functions and immutable data
- **Minimal dependencies** - Keep package sizes small
- **Clear interfaces** - Well-defined APIs between packages

### Testing Strategy

- **Unit tests** - For core business logic
- **Integration tests** - For API endpoints and adapters
- **E2E tests** - For Studio functionality
- **Performance tests** - For critical paths

### Documentation

- **README for each package** - Clear usage examples
- **JSDoc comments** - For all public APIs
- **Type definitions** - Comprehensive TypeScript types
- **Migration guides** - For breaking changes

## 🚀 Getting Started

### Repository Setup

```bash
# Clone and install
git clone https://github.com/your-org/trokky-v2.git
cd trokky-v2
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development
pnpm dev
```

### Creating a New Package

```bash
# Create package structure
mkdir packages/new-package
cd packages/new-package

# Initialize package.json
pnpm init

# Add to workspace
# Edit root package.json to include in workspaces
```

### Package Template

```
packages/new-package/
├── src/
│   ├── index.ts          # Main entry point
│   ├── types.ts          # Type definitions
│   └── __tests__/        # Unit tests
├── package.json          # Package configuration
├── README.md             # Package documentation
├── tsconfig.json         # TypeScript configuration
└── vitest.config.ts      # Test configuration
```

This structure ensures Trokky v2 is maintainable, scalable, and developer-friendly while keeping the core vision of simplicity and composability.