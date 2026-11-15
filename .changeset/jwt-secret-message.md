---
'@trokky/trokky': patch
---

The missing or placeholder JWT secret error no longer tells Cloudflare Workers users to edit `trokky.config.ts`, which their projects do not have: it says how to set `TROKKY_JWT_SECRET` on a server, and on Workers with `wrangler secret put` or `.dev.vars`. `defineConfig()`'s own refusal says the same instead of "JWT secret is required in production".
