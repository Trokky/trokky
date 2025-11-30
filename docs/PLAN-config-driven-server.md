# Config-Driven Server Architecture

**Goal**: Make `trokky.config.ts` the single source of truth, reducing `server.ts` to minimal boilerplate.

**Branches**:
- Trokky: `feature/config-driven-server`
- a production site: `feature/config-driven-server`

---

## Phase 1: Extend TrokkyConfig Types ✅ COMPLETED

> Location: `packages/integrations/express/src/config.ts`

### 1.1 Mail Configuration
- [x] Add `MailConfig` interface to `config.ts`
- [x] Add `mail?: MailConfig` to `TrokkyConfig` interface
- [x] Update `withDefaults()` to pass through mail config

### 1.2 Hooks/Events Configuration
- [x] Add `HooksConfig` interface with document and user events
- [x] Add `WebhookConfig` interface for external integrations
- [x] Add `DocumentEvent` and `UserEvent` payload types
- [x] Add `hooks?: HooksConfig` to `TrokkyConfig`

### 1.3 Custom Routes Configuration
- [x] Add `CustomRoute` interface
- [x] Add `RouteGroup` interface for organizing routes
- [x] Add `RouteHandler` and `MiddlewareHandler` types
- [x] Add `routes?: (CustomRoute | RouteGroup)[]` to `TrokkyConfig`

### 1.4 Server Lifecycle Configuration
- [x] Add `ServerLifecycle` interface with beforeStart, afterStart, beforeShutdown, onError
- [x] Add `lifecycle?: ServerLifecycle` to `ServerConfig`
- [x] Add `trustProxy` option to `ServerConfig`

### 1.5 Exports
- [x] Update `index.ts` with all new type exports
- [x] Add `@trokky/mail` as dependency
- [x] Verify build passes

---

## Phase 2: Create `startServer()` Function ✅ COMPLETED

> Location: `packages/integrations/express/src/server.ts`

### 2.1 Core Server Function
- [x] Create `server.ts` with `startServer(config: TrokkyConfig)` function
- [x] Implement Express app creation internally
- [x] Call `TrokkyExpress.create()` with full config
- [x] Return `TrokkyServerInstance` with control methods
- [x] Add `createServer()` alternative for custom management

### 2.2 Mail Service Integration
- [x] Auto-initialize `MailService` if `config.mail` is provided
- [x] Auto-initialize `MailNotificationService` with core events
- [x] Connect to TrokkyCore event bus

### 2.3 Hooks Registration
- [x] Register document event hooks (created, updated, deleted, published)
- [x] Register user event hooks (created, login, logout)
- [x] Register media event hooks (uploaded, deleted)
- [x] Set up webhook dispatcher with retry logic and signature verification

### 2.4 Custom Routes Mounting
- [x] Mount custom routes from `config.routes`
- [x] Support `RouteGroup` with prefix and shared middleware
- [x] Apply auth middleware based on route config (public, authenticated, admin)

### 2.5 Server Lifecycle
- [x] Call `lifecycle.beforeStart` before mounting routes
- [x] Call `lifecycle.afterStart` after server starts
- [x] Register graceful shutdown handlers (SIGTERM, SIGINT)
- [x] Call `lifecycle.beforeShutdown` on shutdown
- [x] Handle `lifecycle.onError` for uncaught exceptions

### 2.6 Exports
- [x] Export `startServer`, `createServer` from index.ts
- [x] Export `TrokkyServerInstance`, `ServerInfo` types
- [x] Add startup summary banner

---

## Phase 3: Update Package Exports ✅ COMPLETED

> Location: `packages/integrations/express/src/index.ts`

### 3.1 New Exports
- [x] Export `startServer` function
- [x] Export `createServer` (non-starting variant)
- [x] Export `defineConfig`, `withDefaults`, `loadConfig` helpers
- [x] Export all config types

### 3.2 Type Exports
- [x] Export `TrokkyServerInstance`, `ServerInfo`
- [x] Export all configuration interfaces
- [x] Export event types (`DocumentEvent`, `UserEvent`)
- [x] Export route types (`CustomRoute`, `RouteGroup`, `RouteHandler`)

---

## Phase 4: Migrate a production site Backend ✅ COMPLETED

> Location: `a production site/backend/`

### 4.1 Update trokky.config.ts
- [x] Import `defineConfig` from `@trokky/express`
- [x] Add custom routes via `allRoutes` import
- [x] Wrap config with `defineConfig()`

### 4.2 Simplify server.ts
- [x] Replace 1077-line manual setup with `startServer(config)` (~30 lines)
- [x] Move custom route handlers to separate files under `routes/`
- [x] Old server.ts backed up as `server.ts.old`

### 4.3 Restructure Custom Routes
- [x] Create `routes/forms.ts` (contact, newsletter, membership)
- [x] Create `routes/applications.ts` (job applications, OTP with multer)
- [x] Create `routes/admin.ts` (admin-only endpoints with RouteGroup)
- [x] Create `routes/webhooks.ts` (webhook handler, Railway redeploy)
- [x] Create `routes/index.ts` with `allRoutes` export

### 4.4 Test Migration
- [x] Server starts successfully
- [x] PostgreSQL adapter connects and migrates
- [x] Mail service initializes
- [x] 15 custom routes mounted
- [x] Root endpoint responds correctly

### 4.5 Type Fixes (Additional Work)
- [x] Added `postgres-data` to StorageConfig adapter types
- [x] Added `mediaUrlGenerator` to MediaConfig
- [x] Added `apiUrl` to StudioConfig
- [x] Added `FeaturesConfig` interface
- [x] Fixed CORS origin type to support callback functions
- [x] Fixed route type compatibility with Express type casting

---

## Phase 5: Documentation & Examples

> Location: `packages/integrations/express/`

### 5.1 Update README
- [ ] Document new `startServer()` approach
- [ ] Provide migration guide from manual setup
- [ ] Add complete config example

### 5.2 Create Example Project
- [ ] Create minimal example in `examples/express-minimal/`
- [ ] Show trokky.config.ts pattern
- [ ] Show minimal server.ts

---

## Future: CLI Generator (Out of Scope for This PR)

> This phase will be a separate initiative after the config pattern is stable.

- [ ] `npx create-trokky my-project`
- [ ] Interactive prompts for features
- [ ] Template generation based on config
- [ ] Database adapter selection
- [ ] Media adapter selection

---

## Implementation Order

1. **Phase 1.1-1.3** - Extend types (Trokky)
2. **Phase 2.1-2.2** - Create startServer with mail (Trokky)
3. **Phase 4.1-4.2** - Test with a production site migration (a production site)
4. **Phase 2.3-2.5** - Add hooks and lifecycle (Trokky)
5. **Phase 4.3-4.4** - Complete a production site migration (a production site)
6. **Phase 3** - Clean up exports (Trokky)
7. **Phase 5** - Documentation (Trokky)

---

## Success Criteria

### a production site's server.ts Before:
```typescript
// 1077 lines of manual setup
```

### a production site's server.ts After:
```typescript
import config from './trokky.config.js'
import { startServer } from '@trokky/express'

await startServer(config)
```

### trokky.config.ts Contains:
- All schemas
- All storage config
- All security config
- Mail config with templates
- Custom routes as arrays
- Hooks for events
- Server lifecycle

---

## Notes

- Keep backward compatibility with `TrokkyExpress.create()` for advanced use cases
- `startServer()` is the "happy path" for most projects
- Custom routes should support both inline handlers and imported functions
- Consider middleware composition for route groups
