# @trokky/trokky

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
