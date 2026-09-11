---
"@trokky/trokky": patch
"@trokky/studio": patch
"@trokky/client": patch
---

Stop writing secrets to application logs.

Updating a webhook logged the full set of changed fields, so a change that included the webhook's signing secret wrote that secret to the application log in cleartext. The update now logs only the names of the fields that changed, matching what webhook registration and the webhook HTTP route already did.

The server logger now redacts known-sensitive keys from log payloads automatically, at log time, for every level. Values held under names such as `secret`, `password`, `token`, `tokenHash`, `authorization`, `privateKey`, `connectionString` and the OAuth2 device-flow `userCode` and `deviceCode` are replaced with `[REDACTED]`. Key names are normalised before matching, so `setCookie`, `set_cookie` and the wire-format `set-cookie` are all caught, as are `x-api-key` and the other hyphenated names real HTTP headers use. Matching is still an exact match on that normalised form rather than a substring match, so ordinary fields like `tokenCount` or `passwordPolicy` still appear in full. Nested objects and arrays are covered, and the original object is never modified.

The redacted output is inert. Functions are not carried over, so an object's own `toJSON` cannot run during serialization and hand back the value that was just removed. Errors are rebuilt rather than passed through: context attached to an error, such as the request headers hung off a failed HTTP call, is redacted like any other payload, and the error's `name`, `message` and `stack` are carried explicitly so a JSON log no longer renders a thrown error as an empty object. Getters under a sensitive key are never invoked, one that throws is reported as `[Unreadable]` instead of taking the log call down with it, and very deep or very large structures are truncated rather than overflowing the stack.

Several other log lines that dumped whole payloads now log field names or counts instead: creating a document, saving an app token, saving studio settings, updating settings through the config route, a failed event emission, a password reset attempt, the start of a device authorization and the Postgres adapter's query logging. The document create handler was the widest of these, because a failed create logged the entire request body of a collection whose schema is defined by the application author, so the payload could hold credentials under field names no redaction list can anticipate. These were fixed individually; the redaction pass is a backstop, not the fix.

Operators should rotate any affected webhook secrets after upgrading, not before. Rotating first sends the new secret through the very log line being fixed, writing it to the log in cleartext as well.
