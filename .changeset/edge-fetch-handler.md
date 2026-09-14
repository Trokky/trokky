---
"@trokky/trokky": minor
---

Serve Trokky from a web-standard `fetch` handler, so it can run on Cloudflare Workers, Deno and Bun.

```ts
import { createFetchHandler } from '@trokky/trokky/workers'

const handler = createFetchHandler({ core, basePath: '/api' })
export default { fetch: (request: Request) => handler(request) }
```

The route layer already spoke `HttpRequest` → `HttpResponse` and knew nothing about any framework. On an edge runtime the incoming object is already a web `Request`, so the integration is a router lookup between two conversions: no Node streams, no `Buffer`, no `busboy`. Multipart uses the platform's own `request.formData()`, which yields the web `File` objects `HttpRequest.files` was already typed as.

Also exports `@trokky/trokky/routes`. `TrokkyRoutes` was not exported from the package at all, so the framework-agnostic registry could not be reached from outside it.

This is the runtime entry point only. Running Trokky on Workers end to end also needs edge-native storage adapters, which are not part of this release.
