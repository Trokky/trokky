---
"@trokky/routes": patch
"@trokky/core": patch
---

fix(routes): Add server-side slug auto-generation for REST API and CLI

Fixes #66 - Slug fields are now auto-generated server-side when creating or updating documents via REST API or CLI.

Changes:
- Add `slug-processor.ts` with server-side slug generation utilities
- Integrate slug processing into `createDocument` and `updateDocument` handlers
- Support `source` option at both field level and in `options` object
- Implement optimized unique slug generation (single query instead of N+1)
- Add comprehensive test coverage (43 tests)
- Export `SchemaFieldDefinition` type from @trokky/core
- Add `allowSlashes` property to `FieldDefinition` interface

The slug auto-generation now works consistently across:
- Studio UI (client-side, existing)
- REST API (server-side, new)
- Trokky CLI (server-side, new)
