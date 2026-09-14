---
"@trokky/trokky": minor
---

Stop assuming a long-lived process: rate limit counters can be shared, and expired auth state is swept by requests rather than by a timer.

**Rate limiting.** `RateLimiter` kept its counters in a plain `Map` with no seam to replace it. In one process that is exact and free. Across isolates it is a security bug wearing a performance costume: each isolate counts on its own, so the real limit is multiplied by however many are warm, and the limiter still looks like it works.

Counters now live behind a `RateLimitStore`. The default is `MemoryRateLimitStore`, which is the previous behaviour exactly, so nothing changes for a Node deployment. `D1RateLimitStore` (from `@trokky/trokky/adapters/cloudflare-d1`) shares them across isolates using the D1 binding an install already has — no new binding to provision, which matters for one-click deploys. KV would be the wrong tool: its writes take up to a minute to propagate, so a limiter built on it would admit bursts it believes it has already refused.

The unit of exchange is a **lease**, not a request, because `checkRateLimit` guards media reads as well as sign-ins and a shared write per request would be unaffordable. A limiter reserves a slice of the window's quota, spends it locally for free, and returns to the store only when the slice runs out: one statement per `leaseSize` requests. The error this introduces leans safe — an isolate evicted with credit unspent has still spent it, so churn makes the limit stricter than configured, never looser.

**Auth flow state.** The OAuth and passkey routes swept expired state from a module-scope `setInterval`, which assumes a process outliving any request. On an edge runtime that fails twice: work at import time is restricted, and nothing runs between requests, so the timer is either rejected or never fires while still reading as correct. The sweep is now driven by a request, at most once a minute, and is never awaited. That is safe because expiry is already enforced on read, making the sweep pure garbage collection. The module-level "last known adapter" globals both routes kept for the timer are gone with it.
