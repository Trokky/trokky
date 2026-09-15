---
"@trokky/studio": minor
---

A claim screen for a fresh instance.

When the API reports the instance claimable — no users exist yet — the Studio shows a claim form instead of a login form: username, email, password, and the claim secret when the deployment was given one. A successful claim signs the new administrator straight in through the same path as a login. The status check happens once per unauthenticated load and any failure means "show the login form", so a broken endpoint can never hide it.
