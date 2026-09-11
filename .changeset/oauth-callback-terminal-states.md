---
"@trokky/trokky": patch
"@trokky/studio": patch
"@trokky/client": patch
---

Fix the Studio OAuth callback page appearing to process the sign-in forever with no error. When the sign-in state was missing and no session existed — for example when the OAuth callback landed on a different hostname than the one that started sign-in — the page now shows a clear error instead of spinning indefinitely. The token exchange request is also given a 30-second timeout, so a request that never responds ends in the same error state instead of loading forever. In both cases the error screen offers a way back to the login screen. No behavioural change for successful sign-in, MFA, or account-linking flows.
