---
"@trokky/trokky": patch
"@trokky/studio": patch
"@trokky/client": patch
---

Take the MFA TOTP issuer from configuration instead of a fixed name.

Every instance enrolled TOTP under the same generic label, so an operator running more than one Trokky site saw identical entries in their authenticator app with nothing to distinguish them. The account name does not help either, since the same address is usually reused across instances.

A new `security.mfa.issuer` setting controls the name. When it is not set the issuer falls back to the passkey `rpName`, which most deployments already set to the site's own name, and only then to the previous generic fallback. Existing installs therefore get a useful label without anyone editing configuration.

Changing the issuer does not invalidate existing enrolments. The shared secret is what generates the codes and it is unchanged, so users keep working and keep their old label until they re-enrol. Only new enrolments pick up the new name.
