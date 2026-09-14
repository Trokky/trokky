---
"@trokky/trokky": minor
"@trokky/studio": minor
"@trokky/client": minor
---

One place to say where the Studio lives: `studio.url`.

The server needs the Studio's public URL for two things, the device-flow approval page and the base of links in system emails. It learned it from two places: `oauth2.verificationUri`, with a hard-coded `/studio` default, and a raw `STUDIO_URL` environment variable read inside the mail setup. Now `studio.url` (defaulting to `STUDIO_URL`) feeds both: the approval page is `<studio.url>/auth/device` and email links are based on it. `oauth2.verificationUri` remains as an explicit override. When neither is set and mail is configured, the server warns at boot that email links will point at localhost.

Two `studio` keys turned out to be dead and are now ignored with a boot warning rather than kept: `studio.settings` (page size, drafts, versioning, autosave) was never read by the Studio, and `studio.fields` had no reader anywhere. The `customFields` option of `studioRouter()` goes with it.

`studio.session` was dead by a bug: the server served it, but the Studio only read it from the bootstrap and the API merge copied branding alone. The merge now copies the session tuning too, so `refreshBuffer`, `warningBuffer`, `checkInterval` and `inactivityTimeout` take effect.
