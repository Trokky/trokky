---
"@trokky/studio": patch
---

Fix navigation links in embedded Studio to respect basePath

When Studio is embedded at a path like `/studio`, internal links like "Forgot password?" now correctly navigate to `/studio/forgot-password` instead of `/forgot-password`.

Added shared navigation utilities (`getBasePath`, `getStudioPath`, `navigateTo`) and updated:
- LoginPage: "Forgot password?" link
- ForgotPasswordPage: "Back to Sign In" link and button
- ResetPasswordPage: "Sign In" and "Request New Link" buttons
- OAuthCallbackPage: Uses shared utility instead of local helper
