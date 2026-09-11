# Changelog

## 2.0.5

### Patch Changes

- 22dcdc1: Take the MFA TOTP issuer from configuration instead of a fixed name.

  Every instance enrolled TOTP under the same generic label, so an operator running more than one Trokky site saw identical entries in their authenticator app with nothing to distinguish them. The account name does not help either, since the same address is usually reused across instances.

  A new `security.mfa.issuer` setting controls the name. When it is not set the issuer falls back to the passkey `rpName`, which most deployments already set to the site's own name, then to the organisation name, then to the Studio title, and only then to the previous generic fallback. Existing installs therefore get a useful label without anyone editing configuration.

  Enrolment previously read the Studio title first, which commonly still holds its generic default, which is why every instance produced the same label. Configuration now takes precedence over it.

  Colons are stripped from the resolved issuer. The authenticator URI format separates the issuer from the account name with a colon, so one inside the issuer gave the label two separators and apps split on the first, mis-reading both halves. The two halves of the label are also encoded separately now, rather than encoding the joined string.

  Changing the issuer does not invalidate existing enrolments. The shared secret is what generates the codes and it is unchanged, so users keep working and keep their old label until they re-enrol. Only new enrolments pick up the new name.

- 15e998d: Fix the Studio OAuth callback page appearing to process the sign-in forever with no error. When the sign-in state was missing and no session existed — for example when the OAuth callback landed on a different hostname than the one that started sign-in — the page now shows a clear error instead of spinning indefinitely. The token exchange request is also given a 30-second timeout, so a request that never responds ends in the same error state instead of loading forever. In both cases the error screen offers a way back to the login screen. No behavioural change for successful sign-in, MFA, or account-linking flows.
- 621ff0e: Persist pending sign-in state so a restart does not fail a login in progress.

  OAuth login state with its PKCE verifier, and the WebAuthn challenge behind a passkey, were held in a map inside the server process. Both are written when a flow begins and read when it completes, so a restart between those two requests failed the sign-in with an invalid state error, and a deployment running more than one replica could not complete them at all: the second request may reach a different process than the first.

  Both now persist through the data storage adapter. Two optional methods were added to the adapter interface, `saveAuthFlowState` and `consumeAuthFlowState`, alongside `deleteExpiredAuthFlowStates` for the expiry sweep. The Postgres and filesystem adapters implement them; the Postgres adapter creates its table on start like the others, so no manual migration is needed.

  Consumption is a single atomic operation that returns the state and removes it, scoped to the flow it belongs to. These states are single use - an OAuth state is CSRF protection and a WebAuthn challenge must not be answerable twice - so reading and then separately deleting would let two concurrent callbacks both succeed. Postgres uses `DELETE ... RETURNING`; the filesystem adapter claims the file with a rename. Scoping to the flow also means a request carrying another flow's id neither receives nor destroys that state.

  An adapter that does not implement the methods keeps the previous in-process behaviour, so a custom adapter written against the older interface continues to work. An adapter that does implement them and then fails to write raises rather than silently falling back to memory, which would report a durability the caller does not have.

  On the filesystem these records hold PKCE verifiers and WebAuthn challenges, so they are written with private permissions rather than the adapter's defaults.

- ca26993: Stop writing secrets to application logs.

  Updating a webhook logged the full set of changed fields, so a change that included the webhook's signing secret wrote that secret to the application log in cleartext. The update now logs only the names of the fields that changed, matching what webhook registration and the webhook HTTP route already did.

  The server logger now redacts known-sensitive keys from log payloads automatically, at log time, for every level. Values held under names such as `secret`, `password`, `token`, `tokenHash`, `authorization`, `privateKey`, `connectionString` and the OAuth2 device-flow `userCode` and `deviceCode` are replaced with `[REDACTED]`. Key names are normalised before matching, so `setCookie`, `set_cookie` and the wire-format `set-cookie` are all caught, as are `x-api-key` and the other hyphenated names real HTTP headers use. Matching is still an exact match on that normalised form rather than a substring match, so ordinary fields like `tokenCount` or `passwordPolicy` still appear in full. Nested objects and arrays are covered, and the original object is never modified.

  The redacted output is inert. Functions are not carried over, so an object's own `toJSON` cannot run during serialization and hand back the value that was just removed. Errors are rebuilt rather than passed through: context attached to an error, such as the request headers hung off a failed HTTP call, is redacted like any other payload, and the error's `name`, `message` and `stack` are carried explicitly so a JSON log no longer renders a thrown error as an empty object. Getters under a sensitive key are never invoked, one that throws is reported as `[Unreadable]` instead of taking the log call down with it, and very deep or very large structures are truncated rather than overflowing the stack.

  Several other log lines that dumped whole payloads now log field names or counts instead: creating a document, saving an app token, saving studio settings, updating settings through the config route, a failed event emission, a password reset attempt, the start of a device authorization and the Postgres adapter's query logging. The document create handler was the widest of these, because a failed create logged the entire request body of a collection whose schema is defined by the application author, so the payload could hold credentials under field names no redaction list can anticipate. These were fixed individually; the redaction pass is a backstop, not the fix.

  Operators should rotate any affected webhook secrets after upgrading, not before. Rotating first sends the new secret through the very log line being fixed, writing it to the log in cleartext as well.

- Updated dependencies [22dcdc1]
- Updated dependencies [15e998d]
- Updated dependencies [621ff0e]
- Updated dependencies [ca26993]
  - @trokky/trokky@2.0.5

## 2.0.4

### Patch Changes

- @trokky/trokky@2.0.4

## 2.0.3

### Patch Changes

- Updated dependencies [c9081b9]
  - @trokky/trokky@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [33147be]
  - @trokky/trokky@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [6427d4a]
- Updated dependencies [0c3a3e1]
- Updated dependencies [b397497]
  - @trokky/trokky@2.0.1

## 2.0.0

### Major Changes

- 21474db: Trokky 2.0.0 consolidation.

  The project is now three packages published together under a single version:
  `@trokky/trokky` (CMS server: engine, routes, adapters, mail, i18n, Express
  integration), `@trokky/studio` (React admin UI and field system) and
  `@trokky/client` (frontend SDK: HTTP client, query builder, type generation).

  The server package is published as `@trokky/trokky` because GitHub Packages
  only supports scoped npm packages. All packages are ESM-only and expose their
  public API through subpath exports (`@trokky/trokky/express`,
  `@trokky/trokky/types`, `@trokky/trokky/adapters/filesystem-data`, ...).

### Patch Changes

- Updated dependencies [21474db]
  - @trokky/trokky@2.0.0

## 0.2.2

### Patch Changes

- 84a8782: Fix internal dependency version constraints

  Replace wildcard (\*) dependencies with proper semver constraints to prevent version mismatch issues when installing packages. This ensures that packages requiring features from specific versions (like expandDocumentReferences in @trokky/core@2.0.0) will correctly resolve to compatible versions.
  - @trokky/core: ^2.0.0
  - @trokky/types: ^0.1.0
  - @trokky/routes: ^2.0.0
  - @trokky/mail: ^0.1.0
  - @trokky/i18n: ^0.2.0
  - @trokky/fields: ^0.4.0
  - @trokky/studio: ^0.4.0
  - @trokky/adapter-filesystem-data: ^2.0.0
  - @trokky/adapter-filesystem-media: ^2.0.0

- Updated dependencies [84a8782]
  - @trokky/core@2.0.5

## 0.2.1

### Patch Changes

- 0a2567d: Fix expand() to support nested field paths
  - Added support for dot notation in expand() method (e.g., `documentation.featuredDocument`)
  - Added `getNestedValue()` and `setNestedValue()` helpers to traverse object paths
  - Fixed `extractDocument()` to properly unwrap API responses with collection wrappers
  - Updated documentation with comprehensive examples for nested expansion and frontend integration

## 0.2.0

### Minor Changes

- 3bbba91: feat: add server-side reference expansion support

  Added server-side reference expansion via the `expand` query parameter. Documents with reference fields can now return fully expanded referenced documents instead of just reference metadata.

  **API Changes:**
  - GET `/api/collections/:collection/:id?expand=field1,field2[]` - expand specific fields
  - GET `/api/collections/:collection?expand=*` - expand all reference fields
  - Use `[]` suffix for array reference fields (e.g., `categories[]`)

  **@trokky/core:**
  - New `expandDocumentReferences()` utility for expanding references in documents
  - New `parseExpandParam()` for parsing expand query parameter
  - Exports `ReferenceValue`, `ExpandOptions`, `DocumentFetcher` types

  **@trokky/routes:**
  - Document GET and list endpoints now support `expand` query parameter

  **@trokky/client:**
  - `QueryBuilder.expand()` method now uses server-side expansion
  - `SingletonBuilder.expand()` method now uses server-side expansion
  - Falls back to client-side expansion for backward compatibility

  **trokky CLI:**
  - `trokky docs get` now supports `--expand` option

### Patch Changes

- Updated dependencies [3bbba91]
  - @trokky/core@1.0.0

## 0.1.5

### Patch Changes

- 33183c3: Add local schema path support for type generation

  **New Features:**
  - Added `--schema-path` option to CLI for generating types from local schema files
  - New `generateTypesFromPath()` function for programmatic usage

  **CLI Usage:**

  ```bash
  # From local compiled schemas (requires npm run build in CMS)
  npx trokky-client generate-types --schema-path ../cms/dist/schemas -o ./src/types/cms

  # From remote API (existing)
  npx trokky-client generate-types --schema-url http://localhost:3000/api/collections --auth-token TOKEN -o ./src/types/cms
  ```

  **Programmatic Usage:**

  ```typescript
  import { generateTypesFromPath } from '@trokky/client/generator'

  await generateTypesFromPath({
    schemaPath: '../cms/dist/schemas',
    outputDir: './src/types/cms',
    namespace: 'Trokky',
    includeValidation: true,
  })
  ```

  **Bug Fixes:**
  - Fixed index.ts exports using `.js` extension (now extension-less for better compatibility)

  **Notes:**
  - Local schema path requires compiled JS files (run `npm run build` in CMS first)
  - When using with Vite, you may see dynamic import warnings which can be safely ignored

## 0.1.3

### Patch Changes

- a0a5a1c: fix(client): Fix ImageUrlBuilder proxyPath generating double /media/ in URLs

  When using `proxyPath: '/media'`, the builder was generating `/media/media/{id}/file` instead of `/media/{id}/file`.

  Changes:
  - `proxyPath` now replaces the entire base path (no `/media/` prefix added)
  - Proxy mode uses query params (`?w=800`) instead of `/variants/` path
  - Direct mode (no proxyPath) continues to use `/variants/` path for named variants

## 0.1.2

### Patch Changes

- d90b005: feat(client): Add fluent query builder and image URL builder APIs

  New features for easier frontend development:

  **Fluent Query Builder**
  - `client.from('article')` - Start a chainable query
  - `.published()` / `.draft()` - Filter by status
  - `.where()` / `.eq()` / `.gt()` / `.lt()` etc. - Add filters
  - `.expand('category')` - Auto-resolve reference fields
  - `.sort()` / `.newest()` / `.oldest()` - Sort results
  - `.limit()` / `.offset()` - Pagination
  - `.fetch()` / `.first()` / `.count()` - Execute query

  **Singleton Builder**
  - `client.singleton('homepage')` - Fetch singleton documents
  - `.expand()` - Resolve references in singletons
  - `.fresh()` - Bypass cache

  **Image URL Builder**
  - `client.imageUrl(media).width(800).format('webp').url()` - Fluent URL building
  - `client.createImageUrlBuilder()` - Create reusable factory
  - `getSrcSet()` - Generate responsive srcset strings
  - `getBestVariant()` - Auto-select best variant for viewport

  **Server Helpers** (new `/server` export)
  - `createMediaProxy()` - Generic media proxy factory
  - `createAstroMediaProxy()` - Astro-specific handler
  - `createNextMediaProxy()` - Next.js App Router handler
  - `createExpressMediaProxy()` - Express middleware

  All changes are backward compatible - existing code continues to work unchanged.

All notable changes to the `@trokky/client` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-21

### Added

#### Core Client Features

- **TrokkyClient**: Main client class orchestrating all SDK functionality
- **HttpClient**: Low-level HTTP client with authentication and error handling
- **DocumentClient**: High-level document operations with smart caching
- **CacheManager**: TTL-based caching system with automatic cleanup

#### Authentication & Security

- JWT token management with automatic refresh
- Comprehensive error handling with retry logic and exponential backoff
- Support for Bearer token authentication
- Automatic token storage and retrieval

#### Document Operations

- Complete CRUD operations for documents
- Advanced querying with filtering, sorting, and pagination
- Search functionality with text queries and field targeting
- Document counting and existence checking
- Batch operations support

#### Media Management

- File upload support with progress tracking
- Media retrieval and deletion
- Support for both File objects and Buffer data
- Automatic FormData handling

#### TypeScript Features

- **TypeGenerator**: Automatic TypeScript type generation from schemas
- Full type safety throughout the SDK
- Generic document types with proper inference
- Validation schema generation

#### Framework Integration

- Framework-agnostic design (React, Vue, Svelte, Node.js)
- Browser and server-side environment support
- Automatic environment detection for crypto operations
- Support for serverless and edge runtime environments

#### Developer Experience

- Comprehensive TypeScript definitions
- Auto-completion and IntelliSense support
- Debug mode with detailed logging
- Configurable timeouts and retry policies

### Technical Implementation

#### HTTP Client (`src/http/client.ts`)

- Automatic request/response handling with proper error mapping
- Configurable timeout and retry mechanisms
- Request interceptors for authentication
- Response caching integration
- Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)

#### Caching System (`src/cache/manager.ts`)

- In-memory cache with TTL (Time To Live) support
- Automatic cleanup of expired entries
- Cache key generation for consistent caching
- Cache invalidation strategies
- Configurable cache duration

#### Document Client (`src/document/client.ts`)

- High-level abstraction over HTTP operations
- Smart cache integration with invalidation
- Query builder with MongoDB-style operators
- Type-safe document operations
- Automatic cache warming and updating

#### Type Generator (`src/generator/index.ts`)

- Schema-to-TypeScript conversion
- Support for complex field types (objects, arrays, references)
- Validation schema generation
- Configurable output formats (.ts, .d.ts)
- Custom namespace support

### API Reference

#### Main Client

```typescript
class TrokkyClient {
  // Authentication
  authenticate(credentials: AuthConfig): Promise<AuthTokens>
  refreshAuth(): Promise<AuthTokens>
  logout(): Promise<void>
  isAuthenticated(): boolean

  // Documents
  getDocument<T>(type: string, id: string): Promise<DocumentResult<T>>
  queryDocuments<T>(
    type: string,
    options?: QueryOptions
  ): Promise<CollectionResult<T>>
  createDocument<T>(type: string, data: T): Promise<DocumentResult<T>>
  updateDocument<T>(
    type: string,
    id: string,
    data: Partial<T>
  ): Promise<DocumentResult<T>>
  deleteDocument(type: string, id: string): Promise<void>

  // Media
  uploadFile(file: File | Buffer, filename?: string): Promise<MediaResult>
  getMedia(id: string): Promise<MediaResult>
  deleteMedia(id: string): Promise<void>

  // Utilities
  ping(): Promise<{ status: string; timestamp: string }>
  health(): Promise<{ status: string; services: Record<string, string> }>
  clearCache(): void
  destroy(): void
}
```

#### Type Generation

```typescript
class TypeGenerator {
  generateFromUrl(): Promise<void>
  generateFromSchema(schema: ProjectSchema): Promise<void>
}

// Helper functions
generateTypes(options: TypeGeneratorOptions): Promise<void>
generateTypesFromSchema(schema: ProjectSchema, options: TypeGeneratorOptions): Promise<void>
```

### Configuration Options

```typescript
interface ClientConfig {
  baseUrl: string
  apiVersion?: string
  token?: string
  refreshToken?: string
  timeout?: number
  retries?: number
  enableCache?: boolean
  cacheMaxAge?: number
  enableRealtime?: boolean
  websocketUrl?: string
  debug?: boolean
}
```

### Testing

- **88 comprehensive tests** covering all functionality
- Unit tests for each component with mocked dependencies
- Integration tests for end-to-end workflows
- Error scenario testing with comprehensive edge cases
- Performance testing for caching mechanisms

### Quality Assurance

- 100% TypeScript strict mode compliance
- ESLint configuration with production-ready rules
- Comprehensive error handling and user-friendly error messages
- Production-ready logging and debugging utilities
- Memory leak prevention with proper cleanup methods

### Examples and Documentation

- Complete README with usage examples
- React integration guide with hooks and components
- Framework-specific examples (Vue, Svelte)
- TypeScript integration patterns
- Error handling best practices

### Dependencies

- **Runtime Dependencies**: Minimal external dependencies for better security
- **Development Dependencies**: Modern tooling (TypeScript 5.x, Jest, ESLint)
- **Peer Dependencies**: TypeScript 4.5+ for optimal type inference

### Browser Support

- Modern browsers with Fetch API support
- Node.js 16+ for server-side usage
- Edge runtime compatibility (Cloudflare Workers, Vercel Edge)
- React Native compatibility (with polyfills)

### Performance

- Intelligent caching reduces API calls by up to 80%
- Automatic request deduplication
- Lazy loading of type definitions
- Optimized bundle size for frontend applications
- Memory-efficient cache management with automatic cleanup

### Security

- Secure token storage recommendations
- Automatic token refresh to minimize exposure
- Input validation and sanitization
- CSRF protection recommendations
- Security-focused error messages (no sensitive data exposure)

---

**Full Changelog**: Initial release - Complete TypeScript-native client SDK for Trokky CMS
