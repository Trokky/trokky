---
"@trokky/trokky": patch
"@trokky/studio": patch
"@trokky/client": patch
---

Persist pending sign-in state so a restart does not fail a login in progress.

OAuth login state with its PKCE verifier, and the WebAuthn challenge behind a passkey, were held in a map inside the server process. Both are written when a flow begins and read when it completes, so a restart between those two requests failed the sign-in with an invalid state error, and a deployment running more than one replica could not complete them at all: the second request may reach a different process than the first.

Both now persist through the data storage adapter. Three optional methods were added to the adapter interface, `getAuthFlowState`, `saveAuthFlowState` and `deleteAuthFlowState`, alongside `deleteExpiredAuthFlowStates` for the expiry sweep. The Postgres and filesystem adapters implement them; the Postgres adapter creates its table on start like the others, so no manual migration is needed.

An adapter that does not implement them keeps the previous in-process behaviour rather than failing, so a custom adapter written against the old interface continues to work. The same fallback covers a storage failure: a write that cannot reach the adapter is kept in memory so the sign-in in progress still completes on that process.
