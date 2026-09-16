---
'@trokky/trokky': minor
---

New `s3-media` adapter: media on any S3-compatible object store — R2 from a Node process, plus
MinIO, Backblaze B2, Spaces, Ceph and AWS. Until now the only way to keep media off local disk
was the R2 *binding*, which exists only inside a Worker, so a Node install had to have a volume.

Import `@trokky/trokky/adapters/s3-media` and configure `endpoint`, `bucket`, `accessKeyId`,
`secretAccessKey`. `aws4fetch` is an optionalDependency, loaded on first use.

It shares a key layout with `cloudflare-r2`, so one bucket can be handed from a Worker to a Node
server and back — pinned by a test that writes with one adapter and reads with the other. Inside
a Worker the binding is still the better choice: faster, and no credentials to hold.

Unlike the binding, SigV4 can sign a URL, so `getFileUrl` and `getVariantUrl` return presigned
URLs when no `publicBaseUrl` is set instead of returning null.
