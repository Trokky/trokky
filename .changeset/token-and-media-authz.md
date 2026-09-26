---
'@trokky/trokky': patch
---

Security: authorization on media and API tokens, and an authenticated default for the fetch handler.

**`createFetchHandler` now requires authentication by default**, as Express always has. Before,
a Worker built with `createFetchHandler({ core })` — the template, generated sites and the
deployment docs all did this — served every protected route to anonymous callers: listing
users, minting API tokens, writing documents. Nothing changes for Studio, which already sends
its token. A headless frontend that read the API anonymously now needs an API token
(`@trokky/client`'s `apiToken`). To keep an API deliberately open, pass
`authentication: { enabled: false }`.

**Media routes check permissions**, not just that the caller is signed in: `media:read` to list
and get, `media:upload`, `media:edit` to update and regenerate variants, `media:delete` to
delete. A read-only API token can no longer delete media. File and variant serving stay public.
Users are judged on their stored permissions plus their role's defaults, so accounts created
before a role gained a permission are not locked out. Following the role table, authors and
writers can no longer edit or delete media; editors and admins can.

**Token routes require `tokens:read` / `tokens:write` / `tokens:delete`** (admins have all
three). Before, any signed-in user could mint an API token with any permissions. A token can
no longer be granted a permission its creator does not hold, and permissions must be
well-formed `resource:action` strings. An API token that mints tokens cannot grant token
permissions, and its children cannot outlive it. `createdBy` now records the real creator
instead of `'system'` — for attribution only: an API token's session is its own
(`api-token:<id>`), never its creator's account.

**Publishing on create needs publish permission.** Creating a document with
`_status: 'published'` checked only write permission, so a token that could draft could also
put content live; it now needs `publish`, as changing the status on update always has. The same
applies to a create that names an existing `id` (which overwrites that document) and would
unpublish it. `_status` must be `'draft'` or `'published'`; anything else is a 400 instead of
being stored and read as neither.

**Search only returns what the caller may read.** `GET /search` checked only that the caller
was signed in, and returned matches from every collection and the media library. Results now
come only from collections the session can read, and media only with `media:read`.

**Concurrent requests with one API token no longer fail on filesystem storage.** Every request
made with an API token rewrites its usage record, and the filesystem adapters wrote through a
temp file with a fixed name, so two concurrent requests could collide and one came back 401.
Temp files are now unique per write, and failing to record usage no longer fails the request.

**API token expiry is enforced.** `expiresAt` was stored but never checked; an expired token now
fails authentication, and creating a token with a past or malformed `expiresAt` is a 400.

**Before upgrading a site**, check its API tokens: a token that reads media metadata
(`GET /media`, `GET /media/:id`) now needs `media:read`, and a token whose `expiresAt` has
passed stops working. Media file URLs (`/media/:id/file`, variants) are unaffected.
