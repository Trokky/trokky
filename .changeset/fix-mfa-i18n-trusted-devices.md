---
"@trokky/studio": patch
"@trokky/i18n": patch
---

fix(studio): fix MFA i18n translations and trusted devices loading

- Fixed French i18n structure: added `mfa.disable.all` and `mfa.disable.allDesc` keys that were missing (only existed under `mfa.disableDialog`)
- Fixed trusted devices not loading when clicking "Manage" button
- Added loading state while fetching trusted devices
- Fixed response parsing to handle both API response structures