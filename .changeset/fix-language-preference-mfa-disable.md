---
"@trokky/studio": patch
"@trokky/i18n": patch
---

fix: language preference showing old value and mfa.disable i18n key conflict

- Fixed language preference page showing old language after save instead of success message
- Fixed i18n key conflict where `mfa.disable` was used both as string (button) and object (nested keys)
- Renamed button text key from `mfa.disable` to `mfa.disableMethod` in MFASettings component
- Added `disableMethod` translation key to EN and FR locale files