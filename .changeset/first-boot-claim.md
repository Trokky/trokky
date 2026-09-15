---
"@trokky/trokky": minor
---

First-boot claim: create the first administrator from the browser, not from the deployment.

A one-click deploy has nowhere safe to put an admin password. Baking one into a template means every Trokky deployed from it shares a credential; prompting for one at deploy time makes the first thing a newcomer does be inventing a password in a form they cannot see the product behind. So an instance with no users is now *claimable*: the first person to open Studio creates the administrator.

```
GET  /api/auth/claim   ->  { claimable, secretRequired }
POST /api/auth/claim   ->  { username, email, password, secret? }
```

Both are unauthenticated by necessity — there is nobody to authenticate as yet — so the guards matter more than usual:

- **It works exactly once.** Claiming requires *zero* users, not merely no admin, so it closes the moment any account exists and cannot reopen.
- **A concurrent claim cannot produce two owners.** If two requests both get past the check, the lowest user id wins and the other withdraws its account — decided by id rather than by timing, so every instance resolves it identically.
- **A rejected attempt leaves the instance claimable**, so a wrong guess cannot lock the real owner out.
- **A successful claim signs you straight in**, rather than bouncing you to a login form to retype what you just typed.

**Set a claim secret for anything that will sit on a public URL before it is claimed.** `security.claimSecret`, or `TROKKY_CLAIM_SECRET`, makes the claim require it. Without one the claim is open to whoever reaches the instance first — the same model as every comparable self-hosted CMS, and only safe because the window is meant to be the minute between deploying and opening the link. The secret is a deploy-time token rather than a password: shown on screen, used once, never typed again.

`security.adminUser` and `TROKKY_ADMIN_EMAIL`/`TROKKY_ADMIN_PASSWORD` still work and are unchanged. An instance created either way is already claimed, so the new endpoints simply report that.
