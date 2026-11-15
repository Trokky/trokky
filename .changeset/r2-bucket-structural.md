---
'@trokky/trokky': patch
---

`CloudflareR2Adapter` accepts any R2 bucket binding. Its `bucket` option is now typed structurally (`R2BucketLike`) instead of from `@cloudflare/workers-types`' module exports, which a Worker typing `env.MEDIA` from the package's globals or from `wrangler types` could not pass without a cast.
