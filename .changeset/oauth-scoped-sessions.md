---
'@trokky/trokky': patch
'@trokky/studio': patch
---

Security: OAuth2 tokens are scoped, and device login works across processes.

**OAuth2 scopes now limit what a token can do.** A device-flow or authorization-code token used
to carry its user's full rights whatever scopes it was granted, so approving "read content"
gave an admin's token full admin power. Now its rights are the scopes intersected with the
user's own permissions. It is never treated as admin, and a user limited to some collections
stays limited to them. Such a token cannot reach any account or security route (passkeys, MFA,
linked logins, approving other devices or applications, `/auth/refresh`). The one exception is
`GET /auth/me` with the `profile` scope.

**No second-factor secrets over the API.** `GET /auth/me` returned the user's TOTP secret and
backup-code hashes: anyone holding a session could clone the second factor. It now returns
neither (a `backupCodesRemaining` count instead), and an OAuth2 token gets only a minimal
profile (id, username, email, name, role).

**Audit history follows read access.** `/audit-logs/documents/:id` and `/audit-logs/actors/:id`
returned every entry, including full document content before and after each change, to any
signed-in caller. They now return only entries from collections the caller can read.

**Linking a Google account needs a link flow.** The callback took the account to link from the
request's own credential when the flow had been started as a sign-in. It now links only to
the user who started a link flow.

**Every token is accepted only where it belongs.** OAuth2 refresh tokens and MFA pending/setup
tokens are no longer accepted as bearer credentials. An OAuth2 access token can no longer be
exchanged at `/auth/refresh` for a Studio session.

**The person approving chooses the scopes.** The device and authorize consent screens list
each scope with a checkbox. What is left ticked is what the application gets, and it can only
narrow the request. A new approval replaces the stored consent instead of adding to it, so a
narrowing sticks. Two decisions on one device code (two clicks, an approve and a deny) no
longer both succeed: exactly one wins. `POST /auth/authorize` now re-checks the client, the redirect URI (for a
denial too, which was an open redirect), the PKCE challenge and the scopes.

**New scopes `content:publish` and `media:delete`**, which the CLI's `restore` and `clean`
need once scopes are enforced.

**Device and authorization codes live in the data adapter**, like Google sign-in state and
passkey challenges, instead of process memory. So device login works on Workers and behind
more than one replica. The Postgres adapter gains the `saveAuthFlowState` it was missing: until
now every flow on Postgres silently fell back to process memory. Adapters can implement the new
optional `getAuthFlowState`.

**`GET /.well-known/oauth-authorization-server`** is routed (under the API path), with every
scope listed.

**Route errors answer with the right status.** A handler that authenticated outside its own
error handling (23 account routes) threw, which reached clients as a 500 on Workers. Every
handler's errors are now mapped to 401/403/400.

**Upgrading:** CLI logins made before this release requested neither publish nor media
delete. Run `trokky login` again for `restore` and `clean`.
