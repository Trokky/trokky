---
"@trokky/trokky": patch
---

Remove four image processors that were never reachable.

`cloudflare-images`, `cloudflare-transformations`, `cloudflare-transform-store` and `workers-images` were 1,234 lines that nothing could run: the factory case was commented out, `processors/index.ts` deliberately did not export them, and no test ever touched them.

They also predate the Cloudflare Images binding, and three of them are built on mechanisms it supersedes — `fetch()` with `cf.image` and the URL transformation API, both of which need the source image publicly reachable, which an R2 bucket behind Trokky need not be.

`cloudflare-images` stays in the public `media.imageProcessor` union as the reserved name for a real implementation, and now throws the same explicit "not yet implemented" error as `imagekit` and `imgix` rather than falling through to "unknown processor". The internal union drops the three names that only ever described the deleted files.

No behaviour changes: every one of these already threw when selected.
