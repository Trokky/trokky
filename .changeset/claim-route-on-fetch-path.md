---
"@trokky/trokky": patch
---

The first-boot claim is now reachable on Workers.

`GET`/`POST /auth/claim` shipped in 3.3.0 reachable from an Express deployment and absent from the `fetch` handler: `TrokkyRoutes` keeps an explicit route list that `findRoute` consults, and the claim was only ever in the handler group's own list. A Worker answered "No route for POST /auth/claim" while the same package served it fine under Express.

Fixed, and pinned: a test now asserts that every route any handler group defines is findable through the router, so a route can no longer exist for one runtime and not the other.
