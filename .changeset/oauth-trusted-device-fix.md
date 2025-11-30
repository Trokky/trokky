---
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/studio": patch
---

Fix OAuth login not respecting trusted devices for MFA. When logging in with Google OAuth, the system now checks if the device is already trusted and skips MFA verification, matching the behavior of username/password login. The Studio now sends deviceId in the OAuth callback request.
