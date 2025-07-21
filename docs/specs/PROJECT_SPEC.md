# Trokky v2 - Project Specification

## 🎯 Project Overview

**Trokky v2** is a modern, composable Content Management System designed as a true alternative to Sanity. It combines the power of schema-driven development with the simplicity of local-first workflows and the flexibility of framework-agnostic architecture.

## 🚀 Core Mission

Build a CMS that developers **actually want to use** by solving the key pain points of existing solutions:

### Problems with Current CMSs

**Sanity Pain Points:**
- Expensive per-seat pricing model
- Vendor lock-in to Sanity Cloud
- Complex GROQ learning curve
- Limited local development options
- Rigid deployment constraints

**Traditional CMS Pain Points:**
- Monolithic architecture
- Poor developer experience
- Lack of version control for content
- Complex setup and configuration
- Framework lock-in

### Trokky v2 Solutions

✅ **Local-first development** - Content stored as files, works with Git  
✅ **Framework agnostic** - Works with any HTTP framework or serverless platform  
✅ **TypeScript native** - Full type safety, no learning curve  
✅ **Zero vendor lock-in** - Own your data and infrastructure  
✅ **Simple pricing** - Open source, no per-seat costs  
✅ **Modern DX** - Fast setup, intuitive APIs, great tooling  

## 🏗️ Technical Architecture

### Design Principles

1. **Composability over Monolith**
   - Use only the packages you need
   - Mix and match storage adapters
   - Framework-agnostic core components

2. **Local-first Development**
   - Content as files by default
   - Git-friendly workflows
   - Easy migration to cloud storage

3. **TypeScript Native**
   - Schemas defined in TypeScript
   - Auto-generated types throughout
   - Runtime validation matching compile-time types

4. **Developer Experience First**
   - Zero-config defaults
   - Intuitive APIs
   - Great error messages
   - Fast development cycles

### Package Architecture

```
@trokky/core           # CMS engine (schemas, validation, storage interface)
@trokky/routes         # Framework-agnostic route definitions & handlers
@trokky/studio         # Modern React admin interface
@trokky/client         # Frontend SDK with type generation

# Framework Integrations
@trokky/express        # Express.js integration
@trokky/nextjs         # Next.js App Router integration  
@trokky/cloudflare     # Cloudflare Workers integration
@trokky/hono           # Hono edge runtime integration

# Storage Adapters
@trokky/adapter-filesystem    # File-based storage (default)
@trokky/adapter-cloudflare    # Cloudflare D1 + R2 storage
@trokky/adapter-s3            # AWS S3 + DynamoDB storage
```

## 📊 Core Features

### Content Management

- **Document Collections** - Blog posts, products, articles
- **Singleton Documents** - Homepage, settings, about page  
- **Rich Field Types** - Text, images, references, arrays, objects
- **Media Management** - Images, videos, files with cloud storage
- **Content Validation** - Schema-driven validation with TypeScript
- **Draft/Published States** - Content workflow management

### Developer Features

- **Auto-generated APIs** - REST and GraphQL endpoints
- **Type Safety** - Full TypeScript integration
- **Framework Flexibility** - Works with any HTTP framework
- **Storage Adapters** - File-based to cloud storage
- **Migration Tools** - Import from Sanity and other CMSs
- **CLI Tooling** - Project scaffolding and management

### Studio Interface

- **Modern UI** - Clean, intuitive React interface
- **Custom Fields** - Extensible field system
- **Real-time Editing** - Live preview and auto-save
- **Media Browser** - Drag & drop file management
- **User Management** - Authentication and permissions
- **Responsive Design** - Works on desktop and mobile

## 🎯 Target Audience

### Primary Users

**Full-Stack Developers**
- Building web applications with custom frontends
- Want control over their CMS and data
- Prefer TypeScript and modern development workflows
- Need to deploy to various platforms (Vercel, Netlify, AWS, etc.)

**Frontend Developers**
- Working with React, Vue, Svelte, etc.
- Need strongly-typed content APIs
- Want local development capabilities
- Prefer file-based content for version control

**DevOps Engineers**
- Managing content infrastructure
- Need flexible deployment options
- Want to avoid vendor lock-in
- Require scalable storage solutions

### Secondary Users

**Agencies & Consultancies**
- Building sites for multiple clients
- Need cost-effective CMS solutions
- Want white-label capabilities
- Require flexible hosting options

**Content Creators** (via Studio)
- Need intuitive content editing interface
- Want real-time collaboration
- Require media management tools
- Need draft/publish workflows

## 🎉 Current Status & Achievements

### Production-Ready Packages ✅

**`@trokky/core` v0.1.0** - The foundational CMS engine
- ✅ **Schema Management**: TypeScript-native schema registry with Zod validation
- ✅ **User Management**: Complete authentication system with role-based access control
- ✅ **Security-First**: Enterprise-grade crypto adapters, JWT authentication, bcrypt password hashing
- ✅ **Multi-Environment Crypto**: Automatic adapter selection (Node.js, Web Crypto API, fallback)
- ✅ **Storage Interface**: Type-safe adapter pattern for pluggable storage backends
- ✅ **Audit Logging**: Built-in security event tracking and compliance logging
- ✅ **Error Handling**: Custom error classes with detailed error reporting
- ✅ **Test Coverage**: 173 passing tests covering all functionality
- ✅ **Type Safety**: Strict TypeScript with generics throughout

**`@trokky/adapter-filesystem` v0.1.0** - Git-friendly file storage
- ✅ **Local Development**: File-based storage perfect for Git workflows
- ✅ **Security Hardened**: Path traversal protection, atomic writes, extension validation
- ✅ **Media Management**: Binary file support with metadata tracking
- ✅ **Advanced Querying**: MongoDB-style filtering, sorting, and pagination
- ✅ **Migration Support**: Schema evolution and data migration tools
- ✅ **Test Coverage**: 40 passing tests including security and edge cases

**`@trokky/routes` v0.1.0** - Framework-agnostic HTTP route handlers
- ✅ **Complete REST API**: Full CRUD operations for documents, media, and users
- ✅ **User Management API**: Login, logout, user creation, role management, token validation
- ✅ **JWT Authentication**: Secure token-based authentication with role-based access control
- ✅ **Admin Protection**: Automatic admin access validation for user management operations
- ✅ **Enterprise Security**: Authentication, path traversal protection, input validation
- ✅ **Framework Agnostic**: Works with Express, Fastify, Hono, Next.js, and more
- ✅ **Media Upload Security**: File type, size, and malware protection
- ✅ **CORS Management**: Configurable cross-origin resource sharing
- ✅ **Error Handling**: Comprehensive error responses with proper HTTP status codes
- ✅ **Test Coverage**: 51 passing tests including 16 security-focused tests

**`@trokky/express` v0.1.0** - Production-ready Express.js integration
- ✅ **Express Middleware**: Complete Express.js integration with authentication support
- ✅ **File Upload Handling**: Multer integration for secure media uploads
- ✅ **CORS Configuration**: Automatic CORS setup with security defaults
- ✅ **Error Handling**: Express-specific error handling and response formatting
- ✅ **Type Safety**: Full TypeScript support with Express request/response types
- ✅ **Production Ready**: Comprehensive middleware stack for production deployment
- ✅ **Test Coverage**: 37 passing tests covering all integration scenarios

**`@trokky/fields-core` v0.1.0** - Advanced field type system
- ✅ **Comprehensive Field Types**: 13 built-in field types including specialized fields
- ✅ **Core Field Types**: String, number, boolean, date, array, object, reference fields
- ✅ **Specialized Fields**: Slug, email, URL, image, and file fields with advanced validation
- ✅ **Portable Text**: Rich content editing with marks, annotations, and block types
- ✅ **Security-Hardened Validation**: ReDoS-resistant regex patterns and input sanitization
- ✅ **TypeScript Native**: Full type safety with generics and strict validation
- ✅ **Extensible Architecture**: Plugin-ready field type registry system
- ✅ **Test Coverage**: 116 comprehensive tests covering all field types and edge cases

**`@trokky/client` v0.1.0** - TypeScript-native client SDK
- ✅ **Complete REST API Integration**: Full document CRUD operations with authentication
- ✅ **TypeScript Type Generation**: Automatic types from schema definitions
- ✅ **Authentication Management**: JWT token handling with automatic refresh
- ✅ **Smart Caching**: TTL-based caching with intelligent invalidation
- ✅ **Framework Agnostic**: Works with React, Vue, Svelte, Node.js, and serverless
- ✅ **Error Handling**: Comprehensive error handling with retry logic and exponential backoff
- ✅ **Media Management**: File upload support with progress tracking
- ✅ **Query Builder**: Advanced filtering, sorting, pagination, and search
- ✅ **Test Coverage**: 88 comprehensive tests covering all client functionality

**`@trokky/studio` v2.0.0** - Modern React admin interface (Foundation)
- ✅ **Zero-Config Deployment**: Single-file HTML build (317KB gzipped to 93KB) for easy serving
- ✅ **Backend Auto-Discovery**: Multi-strategy discovery (window config, meta tags, URL params, localStorage, auto-discovery)
- ✅ **Modern Architecture**: React 18 + TypeScript + Vite + Tailwind CSS + React Query
- ✅ **Responsive Layout**: Header + 3-panel layout (Main Sidebar, Context Sidebar, Main Content)
- ✅ **Auto-Configuring API**: Capability detection with graceful degradation for missing features
- ✅ **Theme System**: Light/dark/system theme switching with localStorage persistence
- ✅ **Navigation System**: React Router with error boundaries and 404 handling
- ✅ **Mobile Support**: Collapsible sidebars and responsive design for all screen sizes
- ✅ **Global Search**: Modal-based search system (placeholder ready for implementation)
- ✅ **Runtime Configuration**: No rebuild required for backend URL changes
- ✅ **Production Ready**: Clean TypeScript compilation and optimized Vite builds

### Technical Achievements

🔒 **Enterprise-Grade Security**
- **User Authentication System**: Complete JWT-based authentication with role-based access control
- **Password Security**: bcrypt hashing with configurable salt rounds, password strength validation
- **Multi-Environment Crypto**: Automatic adapter selection for Node.js, edge runtimes, and fallback environments
- **Admin Access Control**: Automatic validation for user management operations with permission checking
- **Audit Logging**: Comprehensive security event tracking for compliance and monitoring
- **Path Traversal Protection**: Parameter validation preventing directory traversal attacks
- **Input Sanitization**: Runtime validation and comprehensive input sanitization
- **Authentication Middleware**: Bearer token support with automatic token validation
- **Media Upload Security**: File type, size, extension validation with malware protection
- **CORS Security**: Hardened cross-origin resource sharing (no dangerous defaults)
- **Rate Limiting**: Resource exhaustion protection and DoS prevention
- **Atomic Operations**: Race condition prevention with atomic file operations

🧪 **Quality Assurance**
- 100% test pass rate (505 total tests)
- TypeScript strict mode compliance
- Comprehensive security testing (21 security-focused tests)
- Production-ready code review standards
- Enterprise-grade error handling
- Advanced field validation with security-hardened patterns
- Clean workspace build with all packages

🏗️ **Architecture Excellence**
- Modular, composable design
- Framework-agnostic core
- Type-safe interfaces throughout
- Clean separation of concerns

## 🚧 Implementation Phases

### Phase 1: Foundation (Weeks 1-3) ✅ COMPLETED
- [x] Project structure and specifications
- [x] Core CMS engine (`@trokky/core`) - **PRODUCTION READY**
  - [x] Schema registry with Zod validation
  - [x] Document validation and sanitization
  - [x] Security hardening (input validation, rate limiting)
  - [x] Type-safe storage adapter interface
  - [x] Comprehensive test suite (173 tests passing)
- [x] Filesystem storage adapter (`@trokky/adapter-filesystem`) - **PRODUCTION READY**
  - [x] Git-friendly file-based storage
  - [x] Security hardening (path traversal protection, atomic writes)
  - [x] Document and media management
  - [x] Advanced querying (filtering, sorting, pagination)
  - [x] Migration system and health monitoring
  - [x] Comprehensive test suite (40 tests passing)
- [x] Framework-agnostic routes (`@trokky/routes`) - **PRODUCTION READY**
  - [x] Complete REST API handlers for documents and media
  - [x] Enterprise-grade security implementation
  - [x] Authentication middleware with Bearer token support
  - [x] Media upload security and validation
  - [x] CORS management and error handling
  - [x] Comprehensive test suite (51 tests passing, 16 security tests)
- [x] Advanced field system (`@trokky/fields-core`) - **PRODUCTION READY**
  - [x] Complete field type registry with 13 built-in field types
  - [x] Specialized fields (slug, email, URL, image, file) with advanced validation
  - [x] Portable text field for rich content editing
  - [x] Security-hardened validation patterns (ReDoS prevention)
  - [x] Comprehensive test suite (116 tests passing)

### Phase 1.5: Framework Integration ✅ COMPLETED
- [x] Express.js adapter (`@trokky/express`) - **PRODUCTION READY**
- [x] Proof-of-concept blog example
- [x] Package publishing and documentation

### Phase 2: Client SDK & Studio Foundation ✅ COMPLETED
- [x] Client SDK (`@trokky/client`) - **PRODUCTION READY**
  - [x] Complete REST API integration with authentication
  - [x] TypeScript type generation from schemas
  - [x] Smart caching with TTL-based invalidation
  - [x] Framework-agnostic design (React, Vue, Svelte, Node.js)
  - [x] Error handling with retry logic and exponential backoff
  - [x] Media management with file upload support
  - [x] Query builder with filtering, sorting, pagination
  - [x] Comprehensive test suite (88 tests passing)
- [x] Modern Studio UI (`@trokky/studio`) - **FOUNDATION READY**
  - [x] Zero-config deployment with single-file build
  - [x] Multi-strategy backend auto-discovery system
  - [x] Responsive 3-panel layout (Header + Main Sidebar + Context Sidebar + Main Content)
  - [x] Auto-configuring API client with graceful degradation
  - [x] Complete routing system with React Router and error boundaries
  - [x] Modern UI stack (React 18, TypeScript, Vite, Tailwind CSS)
  - [x] Theme switching (light/dark/system) with localStorage persistence
  - [x] Modal-based global search system (placeholder implementation)
  - [x] Mobile-responsive design with collapsible sidebars
  - [x] Clean TypeScript compilation and production builds
- [ ] Real-time editing capabilities

### Phase 3: Framework Integrations (Weeks 5-6)
- [ ] Next.js integration (`@trokky/nextjs`)
- [ ] Cloudflare Workers integration (`@trokky/cloudflare`)
- [ ] Hono integration (`@trokky/hono`)
- [ ] Advanced storage adapters

### Phase 4: Migration & Ecosystem (Weeks 7-8)
- [ ] Sanity migration tools
- [ ] CLI tooling (`create-trokky`)
- [ ] Documentation site
- [ ] Example projects and templates

### Phase 5: Advanced Features (Weeks 9+)
- [ ] Real-time collaboration
- [ ] Advanced permissions system
- [ ] Plugin architecture
- [ ] GraphQL subscriptions
- [ ] Internationalization support

## 📈 Success Metrics

### Technical Performance ✅ ACHIEVED
- ✅ **Type Safety**: 100% TypeScript coverage with strict mode
- ✅ **Test Coverage**: 505 passing tests (100% pass rate)
- ✅ **Security Standards**: Enterprise-grade security implementation with 21 security tests
- ✅ **Code Quality**: Production-ready with systematic code review workflow
- ✅ **Build Performance**: Fast TypeScript compilation with project references
- ✅ **Framework Agnostic**: Complete HTTP abstraction layer ready for any framework
- ✅ **Field System**: Advanced content modeling with 13 production-ready field types

### Developer Experience ✅ ACHIEVED  
- ✅ **Zero-config Defaults**: Simple, intuitive API design
- ✅ **Great Error Messages**: Custom error classes with context
- ✅ **Local Development**: Git-friendly file-based storage
- ✅ **Framework Agnostic**: Core packages work with any HTTP framework

### Current Goals ✅ ACHIEVED
- ✅ **Complete REST API**: Framework-agnostic route handlers implemented
- ✅ **Framework Integration**: Express.js adapter production-ready
- ✅ **Security Hardening**: Enterprise-grade security implementation complete
- ✅ **Package Publishing**: Ready for NPM publication
- ✅ **Documentation**: API documentation and examples complete

## 🎨 Competitive Positioning

### vs Sanity
- ✅ **Cost**: Open source vs $99/month per user
- ✅ **Control**: Own your data vs vendor lock-in  
- ✅ **Local Dev**: File-based vs cloud-only
- ✅ **Learning Curve**: TypeScript vs GROQ
- ✅ **Deployment**: Deploy anywhere vs Sanity hosting

### vs Strapi
- ✅ **Performance**: Lightweight vs heavy Node.js app
- ✅ **TypeScript**: Native vs added-on
- ✅ **Framework Freedom**: Any framework vs Strapi-specific
- ✅ **Developer Experience**: Modern tooling vs legacy patterns

### vs Contentful
- ✅ **Cost**: Open source vs expensive enterprise pricing
- ✅ **Flexibility**: Custom hosting vs Contentful infrastructure
- ✅ **Development**: Local-first vs API-dependent
- ✅ **Migration**: Built-in tools vs manual processes

## 🛡️ Risk Assessment

### Technical Risks
- **GraphQL Complexity**: Mitigated by auto-generation from schemas
- **Framework Compatibility**: Addressed by adapter pattern
- **Storage Performance**: Solved with pluggable adapter system
- **Type Safety**: Ensured through comprehensive TypeScript integration

### Market Risks
- **Sanity Improvements**: Our local-first approach remains differentiated
- **New Competitors**: Open source nature allows community contributions
- **Enterprise Adoption**: Plan enterprise features and support options

### Resource Risks
- **Development Timeline**: Phased approach allows iterative delivery
- **Documentation**: Parallel documentation development with code
- **Community Building**: Early engagement through open development

## 📝 Next Steps

### Immediate Priorities (Phase 3 Ready)
1. ✅ **Field System Complete** - Advanced field types with security-hardened validation
2. ✅ **Express Integration** - Production-ready `@trokky/express` adapter
3. ✅ **Security Implementation** - Enterprise-grade security with comprehensive testing
4. ✅ **Studio Foundation** - React-based admin interface foundation (`@trokky/studio`)
5. ✅ **Client SDK** - Type-safe frontend client with auto-generated types
6. 🎯 **Studio Content Management** - Implement actual content editing features
7. 🎯 **Framework Integrations** - Next.js, Cloudflare Workers support

### Short Term Goals
1. **Documentation** - Create comprehensive API documentation and guides
2. **Package Publishing** - Publish to NPM with proper versioning
3. **Example Projects** - Build reference implementations for common use cases
4. **Community Engagement** - Share progress and gather developer feedback

### Medium Term Vision
1. **Studio Content Management** - Complete content editing, media management, and user management
2. **Real-time Features** - Live editing, collaboration, and auto-save capabilities
3. **Framework Integrations** - Add Next.js, Cloudflare Workers support
4. **Migration Tools** - Build Sanity import/export capabilities

---

This specification serves as the foundation for building Trokky v2 - a CMS that developers will love to use and clients will love to manage.