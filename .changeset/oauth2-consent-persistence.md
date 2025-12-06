---
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/studio": patch
"@trokky/trokky": patch
---

Add OAuth2 consent persistence and developer tools

OAuth2 Consent Persistence:
- Add `getUserConsent`, `saveUserConsent`, and `revokeUserConsent` methods to engine
- Store consents in user preferences (works with all storage adapters)
- Update authorization route to check for existing consent and authenticate optionally
- Update AuthorizePage to auto-approve seamlessly when consent exists
- Skip consent screen for returning users (similar to Google OAuth behavior)

Developer Tools (trokky dev):
- Add hidden `trokky dev` CLI commands for core developers (requires TROKKY_DEV_MODE=1)
- `trokky dev link` - Link local Trokky packages to a project
- `trokky dev unlink` - Restore published package versions
- `trokky dev rebuild` - Rebuild Trokky packages
- `trokky dev status` - Check which packages are linked
