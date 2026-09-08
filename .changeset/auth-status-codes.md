---
"@trokky/trokky": patch
---

Return 401 and 403 for authentication and permission failures.

`BaseRoutes.errorResponse` mapped an `InvalidInputError` to 401 only when `error.field === 'authorization'`, but the class stores the field in `details.field`, so the branch never matched: every missing, invalid or expired token and every permission denial came back as `400 INVALID_INPUT`. Authentication failures are now 401, permission denials 403, and genuine validation errors stay 400.

`validateAdminAccess` also named its permission denial `authorization`, which would have made it 401 and, in the Studio, triggered a token refresh and could sign an editor out for lacking a permission. It now names `permissions` and returns 403.

Handlers in `documents.ts` and `media.ts` that built this response inline now delegate to `errorResponse`, so they map the same way and keep their `details` field.
