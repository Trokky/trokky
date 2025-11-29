---
"@trokky/studio": patch
"@trokky/express": patch
---

Add Google OAuth support for Studio authentication (frontend implementation)

- Add GoogleLoginButton component for initiating OAuth flow
- Add OAuthCallbackPage to handle OAuth redirects from Google
- Add OAuthProvidersList component to display and manage connected accounts
- Update LoginPage with "Sign in with Google" option
- Update UserPreferencesPage with Connected Accounts section
- Add /oauth/callback route for handling OAuth redirects
- Add Preferences link to user dropdown menu
- Add OAuthConfig interface and oauth support to Express integration
