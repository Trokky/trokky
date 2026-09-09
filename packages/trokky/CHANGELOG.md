# @trokky/trokky

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
