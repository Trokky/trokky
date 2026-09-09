---
"@trokky/trokky": patch
---

Make the two data adapters actually interchangeable, and add a conformance suite that keeps them that way.

`filesystem-data` and `postgres-data` are meant to be swappable — backup and restore move content between them, development runs on one and production on the other — but they disagreed in eight ways that had each been found by hand, after causing a bug. Document identity was the worst: filesystem returned `id`, Postgres returned `_id`, and neither returned both, so `routes/handlers/documents.ts` got `undefined` for search and slug-uniqueness on filesystem, and a singleton check added the same day was silently inert on Postgres.

One 133-test contract now runs against both adapters. It covers CRUD, identity, every system field including null-versus-undefined, value fidelity for falsy and nested values, partial-update semantics, both sort grammars in both directions, filtering, pagination, counting, and the user methods where `lastLoginAt`, `mfa` and `passkeys` had all diverged. The Postgres run skips cleanly when no database is reachable, so CI stays green without one.

Identity is now available as both `id` and `_id` everywhere. Postgres also gained `revision`, `created_by_type` and `updated_by_type` columns with idempotent migrations for existing databases, a `draft` status default that holds under the upsert, SQL NULL mapping to `undefined` rather than `null`, numeric sorting on data fields, and the removal of an implicit 50-row limit that was silently truncating unbounded lists.
