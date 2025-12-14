---
"@trokky/types": patch
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/studio": patch
---

feat: add passkey/WebAuthn passwordless authentication support

- Added PasskeyCredential type and PasskeyConfig configuration in @trokky/types
- Implemented passkey service methods in TrokkyCore (registration, authentication, credential management)
- Created passkey API routes for registration, authentication, and credential management
- Added PasskeyLoginButton component for passwordless login on the login page
- Added PasskeyRegistration component for registering new passkeys
- Added PasskeyManager component for managing existing passkeys in user preferences
- Updated LoginPage to show passkey login option when enabled
- Updated UserPreferencesPage with passkey management section
- Added passkey configuration to demo example
