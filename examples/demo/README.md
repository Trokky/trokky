# The Meridian Almanac — Trokky CMS demo

A small, complete Trokky application: an Express server, four schemas, a Studio
navigation structure, and seed content committed to the repository so there is
something to look at the first time you start it.

The Meridian Almanac is a fictional stargazing quarterly. Every author, article
and address in this demo is invented.

## Run it

From the **repository root** — this is the first command to type, and it builds
`@trokky/trokky` and `@trokky/studio` before starting the demo:

```bash
npm install
npm run dev
```

From **`examples/demo`** directly, once the packages are built:

```bash
npm run dev     # tsx watch server.ts — restarts on file changes
npm start       # tsx server.ts — no watcher
```

Either way:

| | |
| --- | --- |
| API base | http://localhost:3253/api |
| Studio | http://localhost:3253/studio |

The port defaults to `3253` and is read from `PORT` (`trokky.config.ts`:
`Number(process.env.PORT) || 3253`), so `PORT=4000 npm run dev` moves both URLs.

### Signing in

On first boot the server creates an admin user from `security.adminUser` in
`trokky.config.ts`. The defaults exist so `npm run dev` works with no setup:

| | env var | dev default |
| --- | --- | --- |
| Username | `TROKKY_ADMIN_USERNAME` | `editor` |
| Password | `TROKKY_ADMIN_PASSWORD` | `almanac-dev-password` |
| Email | `TROKKY_ADMIN_EMAIL` | `editor@meridian-almanac.example` |
| JWT secret | `TROKKY_JWT_SECRET` | `meridian-almanac-dev-secret-do-not-use-in-production` |

> **These defaults are for local development only.** The password and the JWT
> secret are published in this repository. Anyone who knows the secret can mint
> valid tokens for the instance, so both `TROKKY_JWT_SECRET` and
> `TROKKY_ADMIN_PASSWORD` must be set to real, high-entropy values anywhere the
> server is reachable by anyone but you.

The generated user file is written to `data/system/users/`, which is gitignored.

To talk to the API directly:

```bash
TOKEN=$(curl -s -X POST http://localhost:3253/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"editor","password":"almanac-dev-password"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["token"])')

curl -s http://localhost:3253/api/collections/posts -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3253/api/collections/posts/post-first-light?expand=*" \
  -H "Authorization: Bearer $TOKEN"
```

## What each file demonstrates

### `trokky.config.ts`

- **Adapters are imported for their side effects.** `@trokky/trokky/adapters/filesystem-data`
  and `.../filesystem-media` register themselves in the adapter registry when the
  module is evaluated; without those two imports, naming `'filesystem-data'` under
  `storage` throws at startup.
- **Storage layout.** Editorial content goes in `./data`, and everything the
  server generates for itself — users, tokens, webhooks, settings, audit logs —
  is pointed at `./data/system/*`, which keeps the committed content and the
  machine-local runtime state cleanly separated.
- **Security.** `security.enabled: true`, the JWT secret, and the bootstrap admin
  user described above.
- **Studio.** Enabled at `/studio`, `requireAuth: true`, with branding and the
  navigation from `structure.ts`.
- `server.basePath` is deliberately empty: `trokky.mount(app)` already mounts the
  API under `/api`, and repeating the prefix here would double it.

### `server.ts`

The whole integration is two calls: `TrokkyExpress.create(config)` builds the
core, the storage adapters and the routers; `trokky.mount(app)` attaches the API,
the static routes and the Studio to an ordinary Express app. `getMountedPaths()`
reports where they landed, which is what the startup banner prints.

### `schemas/`

`schemas/index.ts` exports the array that `trokky.config.ts` registers. Between
the four schemas, every field type the demo cares about is exercised:

| Schema | Field types |
| --- | --- |
| `posts.ts` | `string`, `slug` (auto-generated from `title`, unique), `text` with `maxLength`, `richtext`, `media`, `reference` → `authors`, `array` of `reference` → `categories`, `object` (`seo`), `boolean`, `date`, `number` with `min`/`max` |
| `authors.ts` | `string`, `slug`, `text`, `media`, `array` of `object` (label / url / primary) |
| `categories.ts` | `string`, `slug`, `text` — deliberately minimal |
| `site-settings.ts` | `string`, `richtext`, `media`, `object` (`contact`), `array` of `object` (`socialLinks`), `number`, `boolean`, `date` |

`richtext` values are stored as HTML strings. That is the Studio rich text
field's default output format (`outputFormat: 'html'` in
`packages/studio/src/fields/definitions/RichTextField/definition.ts`); the field
can also store ProseMirror/TipTap JSON, but neither schema here opts into it.

### `schemas/site-settings.ts` — why `singleton: true` is mandatory

The schema sets both `type: 'singleton'` and `singleton: true`, and
`structure.ts` has a matching `type: 'singleton'` entry. **The schema flag is the
one that matters.** It is not a duplicate of the structure entry:

- The **schema** answers "does this collection hold exactly one document?" — a
  content-model invariant that governs the create guard, the PUT upsert, and how
  `trokky restore` restores a backup. Only a schema-level singleton has its
  document id preserved across a restore; without the flag, restore treats the
  collection as an ordinary list and **regenerates document ids**, leaving the
  navigation pointing at a document that no longer exists.
- The **structure** entry answers a different question — which document the
  navigation opens and auto-creates. A project may have no custom structure at
  all, or one that varies by user role, so it can never decide the invariant.

This used to be a silent divergence that only surfaced during a restore.
`assertSingletonConsistency()` in
`packages/trokky/src/core/schema/singleton.ts` now runs at startup and **throws**
when the structure presents a collection as a singleton whose schema does not
declare it — the server refuses to boot rather than lose documents later. (The
opposite direction is fine: a singleton schema with no navigation entry simply
gets no menu item.)

### `structure.ts`

The Studio navigation, as a plain `TrokkyStructure` object:

- a **singleton** entry for site settings, with `documentId: 'site-settings'` and
  `options.autoCreate`;
- **groups** (`Editorial`, `People & Sections`) that are collapsible and hold the
  document lists;
- **document lists** with `defaultOrdering`, and list options for paging, search
  (`searchFields`) and sorting (`sortFields`);
- a **filtered** list — `Featured` reuses the `posts` schema with the
  MongoDB-style filter `{ featured: { $eq: true } }`;
- a **divider** for visual grouping.

`validateStructure()` runs `StructureBuilder.validate()` against the registered
schemas and prints problems to stderr instead of throwing, so a typo in a
`schemaType` shows up as a boot warning rather than a dead link in the Studio.

### `data/` — the seed content

Committed, so the Studio and the API have something in them on first run:

```
data/
  posts/       post-first-light.json
               post-charting-the-quiet-hours.json
               post-the-long-winter-occultation.json
  authors/     author-sable-rooke.json
               author-idris-fenn.json
  categories/  category-deep-sky.json
               category-field-notes.json
               category-almanac-tables.json
  siteSettings/site-settings.json
```

The filesystem data adapter stores one JSON file per document at
`data/<collection>/<id>.json`. The envelope has three parts — `id`, `collection`,
and the user fields nested under `data`, with the underscore-prefixed document
metadata kept separately under `metadata`:

```json
{
  "id": "category-deep-sky",
  "collection": "categories",
  "data": {
    "title": "Deep Sky",
    "slug": "deep-sky",
    "description": "Clusters, nebulae and galaxies, and the patience required to see any of them properly."
  },
  "metadata": {
    "createdAt": "2026-01-05T08:00:00.000Z",
    "updatedAt": "2026-01-05T08:00:00.000Z",
    "revision": 1,
    "status": "published"
  }
}
```

On read, the adapter flattens this into a document whose user fields sit at the
top level alongside `id`, `_collection`, `_createdAt`, `_updatedAt`, `_revision`
and `_status` — so the API response looks flat even though the file does not.

References are stored as `{ "_ref": "<document id>", "_type": "<collection>" }`
(a bare id string is also accepted). All the seed references resolve: add
`?expand=author`, `?expand=categories[]` or `?expand=*` to a document request and
the referenced documents are inlined.

**Media fields (`coverImage`, `avatar`, `logo`) are `null` in the seed data.**
Uploads live in `media/`, which is gitignored, so there is no committed image for
them to point at — and a reference to a file that does not exist would be worse
than an empty field. Upload an image in the Studio to populate one.

### `data/system/` is deliberately gitignored

`data/system/` holds users (including password hashes), API tokens, webhooks,
settings and audit logs. Those are runtime artefacts of *your* machine, not
content, and committing them would publish credentials. The `.gitignore` here
excludes `data/system/`, `media/` and `.env*` — leave it that way.
