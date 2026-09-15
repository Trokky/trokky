---
"@trokky/client": minor
---

`ClientConfig.fetch`: supply the fetch the client uses.

Hand it a Worker's own Trokky fetch handler and the client queries the API in-process — no network round trip, no subrequest — which is how a page can render on the same Worker that serves the CMS. Defaults to the global fetch, so nothing changes for existing callers.
