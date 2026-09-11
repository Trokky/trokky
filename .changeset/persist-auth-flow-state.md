---
"@trokky/trokky": patch
"@trokky/studio": patch
"@trokky/client": patch
---

Persist pending sign-in state so a restart does not fail a login in progress.

OAuth login state with its PKCE verifier, and the WebAuthn challenge behind a passkey, were held in a map inside the server process. Both are written when a flow begins and read when it completes, so a restart between those two requests failed the sign-in with an invalid state error, and a deployment running more than one replica could not complete them at all: the second request may reach a different process than the first.

Both now persist through the data storage adapter. Two optional methods were added to the adapter interface, `saveAuthFlowState` and `consumeAuthFlowState`, alongside `deleteExpiredAuthFlowStates` for the expiry sweep. The Postgres and filesystem adapters implement them; the Postgres adapter creates its table on start like the others, so no manual migration is needed.

Consumption is a single atomic operation that returns the state and removes it, scoped to the flow it belongs to. These states are single use - an OAuth state is CSRF protection and a WebAuthn challenge must not be answerable twice - so reading and then separately deleting would let two concurrent callbacks both succeed. Postgres uses `DELETE ... RETURNING`; the filesystem adapter claims the file with a rename. Scoping to the flow also means a request carrying another flow's id neither receives nor destroys that state.

An adapter that does not implement the methods keeps the previous in-process behaviour, so a custom adapter written against the older interface continues to work. An adapter that does implement them and then fails to write raises rather than silently falling back to memory, which would report a durability the caller does not have.

On the filesystem these records hold PKCE verifiers and WebAuthn challenges, so they are written with private permissions rather than the adapter's defaults.
