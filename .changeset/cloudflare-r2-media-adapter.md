---
"@trokky/trokky": minor
---

A Cloudflare R2 media adapter, and the media conformance suite it is written against.

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
