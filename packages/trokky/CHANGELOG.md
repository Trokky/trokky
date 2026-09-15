# @trokky/trokky

## 3.4.1

### Patch Changes

- 7d7058b: The first-boot claim is now reachable on Workers.

  `GET`/`POST /auth/claim` shipped in 3.3.0 reachable from an Express deployment and absent from the `fetch` handler: `TrokkyRoutes` keeps an explicit route list that `findRoute` consults, and the claim was only ever in the handler group's own list. A Worker answered "No route for POST /auth/claim" while the same package served it fine under Express.

  Fixed, and pinned: a test now asserts that every route any handler group defines is findable through the router, so a route can no longer exist for one runtime and not the other.

## 3.4.0

### Minor Changes

- 8526c51: Image variants on Workers: the `cloudflare-images` processor, backed by the Images binding.

  ```ts
  media: {
    imageProcessor: 'cloudflare-images',
    imageProcessorOptions: { images: env.IMAGES },
  }
  ```

  Variants are made once, at upload, through `env.IMAGES` on the raw bytes, and stored in R2 through the existing `saveVariantFile` pipeline. That shape is deliberate: the binding never needs the bucket to be public, and because a binding call bills every time while URL transformations bill once per unique transformation per month, doing it once at upload is a one-time cost rather than a recurring one. Every variant is retried — the real service fails roughly one call in fifteen transiently — and a failure that survives the retries is reported on the media record, not swallowed.

  Requires an `images` binding in `wrangler.jsonc`. `fit: 'fill'` and `'outside'` map to Cloudflare's nearest crop behaviour, since it has no stretch.

## 3.3.0

### Minor Changes

- 62f862b: First-boot claim: create the first administrator from the browser, not from the deployment.

  A one-click deploy has nowhere safe to put an admin password. Baking one into a template means every Trokky deployed from it shares a credential; prompting for one at deploy time makes the first thing a newcomer does be inventing a password in a form they cannot see the product behind. So an instance with no users is now _claimable_: the first person to open Studio creates the administrator.

  ```
  GET  /api/auth/claim   ->  { claimable, secretRequired }
  POST /api/auth/claim   ->  { username, email, password, secret? }
  ```

  Both are unauthenticated by necessity — there is nobody to authenticate as yet — so the guards matter more than usual:

  - **It works exactly once.** Claiming requires _zero_ users, not merely no admin, so it closes the moment any account exists and cannot reopen.
  - **A concurrent claim cannot produce two owners.** If two requests both get past the check, the lowest user id wins and the other withdraws its account — decided by id rather than by timing, so every instance resolves it identically.
  - **A rejected attempt leaves the instance claimable**, so a wrong guess cannot lock the real owner out.
  - **A successful claim signs you straight in**, rather than bouncing you to a login form to retype what you just typed.

  **Set a claim secret for anything that will sit on a public URL before it is claimed.** `security.claimSecret`, or `TROKKY_CLAIM_SECRET`, makes the claim require it. Without one the claim is open to whoever reaches the instance first — the same model as every comparable self-hosted CMS, and only safe because the window is meant to be the minute between deploying and opening the link. The secret is a deploy-time token rather than a password: shown on screen, used once, never typed again.

  `security.adminUser` and `TROKKY_ADMIN_EMAIL`/`TROKKY_ADMIN_PASSWORD` still work and are unchanged. An instance created either way is already claimed, so the new endpoints simply report that.

## 3.2.0

### Minor Changes

- b976e31: A Cloudflare D1 data adapter, written against the conformance suite.

  ```ts
  import '@trokky/trokky/adapters/cloudflare-d1'

  storage: { data: { adapter: 'cloudflare-d1', options: { database: env.DB } } }
  ```

  It passes all 113 conformance tests (134 cases with the divergent-field matrix expanded) — the same suite the filesystem and Postgres adapters answer to, which exists because those two silently disagreed in eight ways. The suite runs against a **real D1**: Miniflare boots workerd and hands back a `D1Database`, so actual D1 semantics are exercised from an ordinary Node test run, with no separate runner. It has no external dependency, so unlike the Postgres runner it never skips.

  SQLite differs from Postgres in ways that stay invisible until a test fails, so the notable choices are deliberate:

  - **Timestamps come from JS, never from SQL.** SQLite's `CURRENT_TIMESTAMP` has one-second resolution, and the ordering fixtures are 20ms apart.
  - **Document payloads are one JSON text blob**, so `0`, `false`, `''`, `null` and absent stay distinguishable.
  - **Filters compare `json_type` as well as value**, because `json_extract` collapses JSON booleans to 0/1 and `false` would otherwise match a stored `0`.
  - **Sorts use `json_extract`**, which yields real SQL numbers; the text accessors sort 13 before 2.
  - **No `beginTransaction`.** D1 has no interactive transactions. The three places needing atomicity each do it in one statement: the document upsert via `ON CONFLICT`, `saveUserIf` via a conditional `UPDATE … RETURNING`, and `consumeAuthFlowState` via `DELETE … RETURNING`, which is what makes single-use auth state safe across isolates.

  Also exports `@trokky/trokky/adapters/cloudflare-d1`, registering itself as `cloudflare-d1` for the `edge` and `cloudflare` environments.

- 6b0b978: A Cloudflare R2 media adapter, and the media conformance suite it is written against.

  ```ts
  import '@trokky/trokky/adapters/cloudflare-r2'

  storage: { media: { adapter: 'cloudflare-r2', options: { bucket: env.MEDIA } } }
  ```

  **The suite came first.** There was no media conformance suite at all: the filesystem media adapter was the contract by accident, and a second implementation would have shipped unvalidated. `media-conformance.ts` now pins what `MediaService` and the media routes actually depend on — 63 cases covering upload validation, byte-exact round-tripping of non-UTF-8 content, metadata merge semantics, listing filters, sorting, pre-pagination totals, and the variant lifecycle. It is specified against the real call order the service produces, not against whatever one adapter happens to do. Optional interface methods are declared by each runner rather than probed at runtime, so a method going missing fails a runner instead of silently skipping a test.

  `FilesystemMediaAdapter` passes it, and so does the new R2 adapter — against a **real R2 bucket**, via Miniflare, the same way the D1 runner gets a real D1.

  R2 is a flat object store with no metadata queries and no transactions, so:

  - **Bytes and description are separate objects.** `files/<id>` and `meta/<id>.json`: renaming a photo must not rewrite 12MB, and serving it must not parse JSON.
  - **The listing carries its own index.** Sortable and filterable fields are mirrored into each record's `customMetadata`, so `listMedia` filters, sorts and counts from one `list()` sweep and reads full records only for the page it returns. Listing 900 files is one sweep, not 900 GETs.
  - **The record object is the authority on existence.** Written last on upload, deleted first on delete, so an interrupted operation can orphan bytes — which `cleanup()` reclaims — but never leave a listing entry pointing at nothing.
  - **Variant keys carry no format.** `variants/<id>/<name>` with the format in `customMetadata`, so re-encoding a variant overwrites it instead of leaving both formats behind.
  - **Caller metadata is namespaced.** `updateFile({ size: 0 })` cannot shadow the real size in the listing index.

  A `prefix` option lets one bucket host several installs, isolated from each other. `getFileUrl`/`getVariantUrl` return direct URLs when `publicBaseUrl` is set and null otherwise — a bucket binding cannot presign, so the alternative is serving bytes through Trokky's own media routes.

- 638f265: Serve Trokky from a web-standard `fetch` handler, so it can run on Cloudflare Workers, Deno and Bun.

  ```ts
  import { createFetchHandler } from '@trokky/trokky/workers'

  const handler = createFetchHandler({ core, basePath: '/api' })
  export default { fetch: (request: Request) => handler(request) }
  ```

  The route layer already spoke `HttpRequest` → `HttpResponse` and knew nothing about any framework. On an edge runtime the incoming object is already a web `Request`, so the integration is a router lookup between two conversions: no Node streams, no `Buffer`, no `busboy`. Multipart uses the platform's own `request.formData()`, which yields the web `File` objects `HttpRequest.files` was already typed as.

  Also exports `@trokky/trokky/routes`. `TrokkyRoutes` was not exported from the package at all, so the framework-agnostic registry could not be reached from outside it.

  This is the runtime entry point only. Running Trokky on Workers end to end also needs edge-native storage adapters, which are not part of this release.

- 13b6dce: Retry transient media processing failures, and stop swallowing the ones that remain.

  Remote image processing is not reliable enough to call once. Measured against Cloudflare's real Images service, roughly **one call in fifteen** of a 6MB JPEG fails transiently — `Network connection lost`, `internal error; reference = ...`. `MediaService` used to catch those, log a warning and carry on, so the upload returned looking complete with no thumbnail attached. That is the same shape as the `autoThumbnail` write drop that cost 97 of 124 articles their images.

  Three steps now retry with exponential backoff and jitter — processing the image, writing each variant, and persisting the variant metadata. Jitter matters because variants are generated in a loop: a batch that fails together would otherwise retry together, in step, against the same overloaded backend. Input nothing can fix (`unsupported format`, `too large`) is not retried, so a permanent failure still fails fast.

  What survives the retries is **reported, not swallowed**. The media record gains an `imageProcessing` field:

  ```jsonc
  {
    "status": "partial", // or "failed"
    "failures": [
      {
        "stage": "save-variant",
        "variant": "thumbnail",
        "error": "Network connection lost.",
      },
    ],
    "failedAt": "2026-09-14T22:41:07.000Z",
  }
  ```

  Its absence means every variant was generated and stored, so a clean upload is unmarked and nothing downstream changes. Failures now log at `error` rather than `warn`.

  Uploads still do not throw when variants fail: the original file is stored and is what the user actually sent, so failing would send them to re-upload something already safe. The difference is that the record now says it is incomplete instead of looking finished.

  Upload and `regenerateMediaVariants` share one generation path, so their retry and reporting behaviour cannot drift apart.

  `withRetry` is exported from `@trokky/trokky` for adapters and custom processors that face the same problem.

- b976e31: Stop assuming a long-lived process: rate limit counters can be shared, and expired auth state is swept by requests rather than by a timer.

  **Rate limiting.** `RateLimiter` kept its counters in a plain `Map` with no seam to replace it. In one process that is exact and free. Across isolates it is a security bug wearing a performance costume: each isolate counts on its own, so the real limit is multiplied by however many are warm, and the limiter still looks like it works.

  Counters now live behind a `RateLimitStore`. The default is `MemoryRateLimitStore`, which is the previous behaviour exactly, so nothing changes for a Node deployment. `D1RateLimitStore` (from `@trokky/trokky/adapters/cloudflare-d1`) shares them across isolates using the D1 binding an install already has — no new binding to provision, which matters for one-click deploys. KV would be the wrong tool: its writes take up to a minute to propagate, so a limiter built on it would admit bursts it believes it has already refused.

  The unit of exchange is a **lease**, not a request, because `checkRateLimit` guards media reads as well as sign-ins and a shared write per request would be unaffordable. A limiter reserves a slice of the window's quota, spends it locally for free, and returns to the store only when the slice runs out: one statement per `leaseSize` requests. The error this introduces leans safe — an isolate evicted with credit unspent has still spent it, so churn makes the limit stricter than configured, never looser.

  **Auth flow state.** The OAuth and passkey routes swept expired state from a module-scope `setInterval`, which assumes a process outliving any request. On an edge runtime that fails twice: work at import time is restricted, and nothing runs between requests, so the timer is either rejected or never fires while still reading as correct. The sweep is now driven by a request, at most once a minute, and is never awaited. That is safe because expiry is already enforced on read, making the sweep pure garbage collection. The module-level "last known adapter" globals both routes kept for the timer are gone with it.

### Patch Changes

- cd9a33b: Remove four image processors that were never reachable.

  `cloudflare-images`, `cloudflare-transformations`, `cloudflare-transform-store` and `workers-images` were 1,234 lines that nothing could run: the factory case was commented out, `processors/index.ts` deliberately did not export them, and no test ever touched them.

  They also predate the Cloudflare Images binding, and three of them are built on mechanisms it supersedes — `fetch()` with `cf.image` and the URL transformation API, both of which need the source image publicly reachable, which an R2 bucket behind Trokky need not be.

  `cloudflare-images` stays in the public `media.imageProcessor` union as the reserved name for a real implementation, and now throws the same explicit "not yet implemented" error as `imagekit` and `imgix` rather than falling through to "unknown processor". The internal union drops the three names that only ever described the deleted files.

  No behaviour changes: every one of these already threw when selected.

- 93e3617: Bundle for Cloudflare Workers without the caller aliasing optional Node dependencies.

  `sharp`, `pg` and `bcrypt` never execute on Workers, and the code loading them already sat behind a dynamic `import()` for that reason. That is not enough: a bundler resolves a literal dynamic import whether or not the branch runs, and the surviving reference broke the Worker at startup with `Unable to resolve ... dependency "sharp": no matching module rules`. sharp pulls in `detect-libc`, which wants `fs` and `child_process`.

  Hiding the specifier behind a variable is not a fix either — workerd rejects a non-literal dynamic specifier at parse time, executed or not. So `sharp` is now loaded through `require`, which no bundler follows and workerd never parses, matching how `bcrypt` was already loaded. Node behaviour is unchanged; sharp is CommonJS anyway.

  A Worker build needs no `alias` entries now. `nodejs_compat` is still required, for `crypto`, `events` and `module`.

  Guarded by a test that bundles the edge entry points for a workerd target and asserts nothing external survives but Node built-ins, and that no Trokky source reaching the bundle uses a non-literal dynamic specifier. Both halves were confirmed to fail before the fix.

## 3.1.0

### Minor Changes

- 4f94b04: One place to say where the Studio lives: `studio.url`.

  The server needs the Studio's public URL for two things, the device-flow approval page and the base of links in system emails. It learned it from two places: `oauth2.verificationUri`, with a hard-coded `/studio` default, and a raw `STUDIO_URL` environment variable read inside the mail setup. Now `studio.url` (defaulting to `STUDIO_URL`) feeds both: the approval page is `<studio.url>/auth/device` and email links are based on it. `oauth2.verificationUri` remains as an explicit override. When neither is set and mail is configured, the server warns at boot that email links will point at localhost.

  Two `studio` keys turned out to be dead and are now ignored with a boot warning rather than kept: `studio.settings` (page size, drafts, versioning, autosave) was never read by the Studio, and `studio.fields` had no reader anywhere. The `customFields` option of `studioRouter()` goes with it.

  `studio.session` was dead by a bug: the server served it, but the Studio only read it from the bootstrap and the API merge copied branding alone. The merge now copies the session tuning too, so `refreshBuffer`, `warningBuffer`, `checkInterval` and `inactivityTimeout` take effect.

## 3.0.0

### Major Changes

- 36828ab: Studio mounts itself. The server no longer serves the admin UI, and the dependency cycle between `@trokky/trokky` and `@trokky/studio` is gone.

  **Before**, the server auto-mounted Studio from `config.studio` by dynamically importing `@trokky/studio/dist/server/assets.js`, a build artifact, behind a type-check suppression, and served a 404 in silence when that import failed. **Now** a site mounts Studio like any other router:

  ```ts
  import { studioRouter } from '@trokky/studio/express'

  const server = await startServer(config)
  server.app.use('/studio', studioRouter({ apiPath: '/api' }))
  ```

  Mount it before any catch-all (your Astro handler, `express.static`). The router serves the built SPA and injects only the bootstrap the UI needs: the API path, the mount path (read from `req.baseUrl`, so any prefix works), an optional explicit `backendUrl` for proxies that rewrite the Host header, and optional branding and i18n defaults for the login screen. Everything else Studio already fetches from the API. It mounts on Express 4 and 5.

  **Config changes, all refused with a message naming the fix:**

  - `studio.structure` moves to the top-level `structure`. The server reads it for singleton enforcement and the boot-time consistency check, so it was never only Studio's.
  - `studio.enabled`, `studio.path`, `studio.apiUrl` and `studio.requireAuth` are gone. The last two never did anything.
  - `studio.branding`, `studio.fields`, `studio.settings` and `studio.session` stay: they are served to the UI over `GET /config/studio`.
  - `mount()` no longer takes `studioPath`; `getMountedPaths()` returns only `apiPath`; `getInfo()` no longer reports `studioPath` or `studioEnabled`.
  - The device-flow approval URL is configurable as `oauth2.verificationUri`, defaulting to `${issuer}/studio/auth/device` as before.

  `@trokky/trokky` drops its optional peer dependency on `@trokky/studio`. `@trokky/studio` still depends on `@trokky/trokky` for types and translations, which is the normal direction. `@trokky/studio` gains the `./express` entry and loses the `./dist/server/assets.js` export.

## 2.0.7

### Patch Changes

- Updated dependencies [4712195]
  - @trokky/studio@2.0.7

## 2.0.6

### Patch Changes

- 1cf7c49: Stop discarding `_thumbnail` and other schema-declared underscore fields on write.

  `stripSystemFields` in the document handlers and in `DocumentService` removed every top-level key beginning with `_` except `_status` and `_type`, to keep clients from shadowing storage-managed metadata. But the schema registry injects `_thumbnail` for the autoThumbnail feature, and a project may declare its own underscore-prefixed fields. Those are editor content. Every thumbnail set through the API — from Studio, from `trokky restore`, from any client — was silently dropped: the response said success and the stored document had no thumbnail. Values written under v0.1.x remained readable, which hid the regression.

  Underscore keys that the collection's resolved schema declares as fields are now kept; undeclared ones are still stripped.
  - @trokky/studio@2.0.6

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
  - @trokky/studio@2.0.5

## 2.0.4

### Patch Changes

- Updated dependencies [1aa1229]
  - @trokky/studio@2.0.4

## 2.0.3

### Patch Changes

- c9081b9: Make the two data adapters actually interchangeable, and add a conformance suite that keeps them that way.

  `filesystem-data` and `postgres-data` are meant to be swappable — backup and restore move content between them, development runs on one and production on the other — but they disagreed in eight ways that had each been found by hand, after causing a bug. Document identity was the worst: filesystem returned `id`, Postgres returned `_id`, and neither returned both, so `routes/handlers/documents.ts` got `undefined` for search and slug-uniqueness on filesystem, and a singleton check added the same day was silently inert on Postgres.

  One 133-test contract now runs against both adapters. It covers CRUD, identity, every system field including null-versus-undefined, value fidelity for falsy and nested values, partial-update semantics, both sort grammars in both directions, filtering, pagination, counting, and the user methods where `lastLoginAt`, `mfa` and `passkeys` had all diverged. The Postgres run skips cleanly when no database is reachable, so CI stays green without one.

  Identity is now available as both `id` and `_id` everywhere. Postgres also gained `revision`, `created_by_type` and `updated_by_type` columns with idempotent migrations for existing databases, a `draft` status default that holds under the upsert, SQL NULL mapping to `undefined` rather than `null`, numeric sorting on data fields, and the removal of an implicit 50-row limit that was silently truncating unbounded lists.
  - @trokky/studio@2.0.3

## 2.0.2

### Patch Changes

- 33147be: Warn when a singleton's stored document id differs from the id its structure names, give the storage and mail adapters a teardown path so a process can exit cleanly, and move nodemailer from 6 to 10.

  The stored-id check reads the identity from both `id` and `_id`: filesystem-data returns one and postgres-data the other, so reading a single field made the check silently inert on Postgres — which is what the deployed instances run.

- Updated dependencies [67f0cac]
  - @trokky/studio@2.0.2

## 2.0.1

### Patch Changes

- 6427d4a: Return 401 and 403 for authentication and permission failures.

  `BaseRoutes.errorResponse` mapped an `InvalidInputError` to 401 only when `error.field === 'authorization'`, but the class stores the field in `details.field`, so the branch never matched: every missing, invalid or expired token and every permission denial came back as `400 INVALID_INPUT`. Authentication failures are now 401, permission denials 403, and genuine validation errors stay 400.

  `validateAdminAccess` also named its permission denial `authorization`, which would have made it 401 and, in the Studio, triggered a token refresh and could sign an editor out for lacking a permission. It now names `permissions` and returns 403.

  Handlers in `documents.ts` and `media.ts` that built this response inline now delegate to `errorResponse`, so they map the same way and keep their `details` field.

- 0c3a3e1: Persist `lastLoginAt` on the Postgres adapter.

  `updateUserRow`, shared by `saveUser` and `saveUserIf`, enumerated the columns it COALESCEs and omitted `last_login_at`, so every login wrote the value and Postgres discarded it. The filesystem adapter persisted it, so the two backends disagreed. The column already exists in the table definition, so no migration is needed for existing databases.

- b397497: Make the schema the single source of truth for singletons.

  Whether a collection holds exactly one document was answered three different ways: the PUT upsert read `schema.singleton`, while the create guard and read-time auto-creation walked the project's structure and, with no structure function configured, fell back to a hardcoded list of collection names. The CLI reads the schema flag. A project that declared a singleton in only one place therefore got a system where half the feature worked, and the divergence stayed invisible until a backup was restored — restore preserves ids for singletons and regenerates them otherwise, so the structure ended up pointing at documents that no longer existed.

  All call sites now read the schema. A `type: 'singleton'` structure entry only decides which document id the navigation opens and whether to auto-create it.

  - The hardcoded `homePage` / `settings` / `config` / `siteSettings` fallbacks are removed. In the create guard they matched on collection name alone, so a project without a custom structure could silently acquire singleton enforcement under an invented document id.
  - A structure supplied as a plain object instead of a function is now handled; it previously fell through to those hardcoded names.
  - `options.autoCreate: false` is now honoured, having been validated and documented but only logged.
  - Auto-creation is limited to the singleton's own document id, so a read can no longer mint a document under an arbitrary id.
  - `TrokkyExpress.create()` now fails at startup, naming each offending collection, when the structure presents a collection as a singleton that its schema does not declare.

- Updated dependencies [db04830]
  - @trokky/studio@2.0.1

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
  - @trokky/studio@2.0.0
