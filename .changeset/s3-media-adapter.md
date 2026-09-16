---
'@trokky/trokky': minor
---

New `s3-media` adapter: media on any S3-compatible object store — R2 from a Node process, plus
MinIO, Backblaze B2, Spaces, Ceph and AWS. Until now the only way to keep media off local disk
was the R2 *binding*, which exists only inside a Worker, so a Node install had to have a volume.

Import `@trokky/trokky/adapters/s3-media` and configure `endpoint`, `bucket`, `accessKeyId`,
`secretAccessKey`. `aws4fetch` (11KB, WebCrypto) is a dependency, so there is nothing to install
separately.

It shares a key layout with `cloudflare-r2`, so one bucket can be handed from a Worker to a Node
server and back — pinned by a test that writes with one adapter and reads with the other. Inside
a Worker the binding is still the better choice: faster, and no credentials to hold.

Unlike the binding, SigV4 can sign a URL, so `getFileUrl` and `getVariantUrl` return presigned
URLs when no `publicBaseUrl` is set instead of returning null. **That URL is itself the
authorisation** — a time-limited read grant, not a public link — so treat it accordingly; the
`MediaStorageAdapter` interface now says so.

Also fixes the Express config types, which named a `'s3'` adapter that never existed and omitted
every S3 option, so there was no type-checking way to configure this through `TrokkyExpress.create()`.
