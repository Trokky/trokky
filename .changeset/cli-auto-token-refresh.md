---
"@trokky/trokky": patch
---

Add automatic OAuth2 token refresh for CLI commands

- Automatically refresh expired access tokens using stored refresh tokens
- Display "(token refreshed)" indicator when token is refreshed
- Clear error message when refresh fails and re-login is required
- 5-minute buffer to proactively refresh tokens before expiration
