---
"@trokky/studio": patch
---

Bound the whole OAuth callback exchange, not just its request.

The callback page gave the token-exchange request a 30-second abort signal, but a 401-recovery refresh run inside the HTTP client is issued without that signal, so when the refresh hung the page stayed on "processing" forever. The exchange now races a deadline that covers everything the transport does. A result arriving after the deadline can no longer flip the page out of its error state, a genuine failure landing just after the deadline is reported as itself rather than as a timeout, and a synchronous throw before the request also lands in the error state.
