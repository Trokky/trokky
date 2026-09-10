---
"@trokky/trokky": patch
"@trokky/studio": patch
"@trokky/client": patch
---

Stop writing secrets to application logs.

Updating a webhook logged the full set of changed fields, so a change that included the webhook's signing secret wrote that secret to the application log in cleartext. The update now logs only the names of the fields that changed, matching what webhook registration and the webhook HTTP route already did.

The server logger now redacts known-sensitive keys from log payloads automatically, at log time, for every level. Values held under names such as `secret`, `password`, `token`, `tokenHash`, `authorization`, `privateKey`, `connectionString` and the OAuth2 device-flow `userCode` and `deviceCode` are replaced with `[REDACTED]`. Matching is a case-insensitive exact match against a fixed list rather than a substring match, so ordinary fields like `tokenCount` or `passwordPolicy` still appear in full. Nested objects and arrays are covered, and the original object is never modified.

Several other log lines that dumped whole payloads now log field names or counts instead: creating a document, saving an app token, saving studio settings, a failed event emission, a password reset attempt, the start of a device authorization and the Postgres adapter's query logging. The document create handler was the widest of these, because a failed create logged the entire request body of a collection whose schema is defined by the application author, so the payload could hold credentials under field names no redaction list can anticipate. These were fixed individually; the redaction pass is a backstop, not the fix.

Operators should rotate any affected webhook secrets after upgrading, not before. Rotating first sends the new secret through the very log line being fixed, writing it to the log in cleartext as well.
