---
"@trokky/routes": patch
"@trokky/client": patch
"@trokky/express": patch
"@trokky/mail": patch
"@trokky/adapter-filesystem": patch
"@trokky/adapter-filesystem-data": patch
"@trokky/adapter-filesystem-media": patch
"@trokky/adapter-postgres-data": patch
"@trokky/mail-adapter-console": patch
"@trokky/mail-adapter-resend": patch
"@trokky/mail-adapter-smtp": patch
"@trokky/structure": patch
"@trokky/studio": patch
"@trokky/trokky": patch
"@trokky/fields": patch
"@trokky/i18n": patch
"@trokky/core": patch
---

Fix internal dependency version constraints

Replace wildcard (*) dependencies with proper semver constraints to prevent version mismatch issues when installing packages. This ensures that packages requiring features from specific versions (like expandDocumentReferences in @trokky/core@2.0.0) will correctly resolve to compatible versions.

- @trokky/core: ^2.0.0
- @trokky/types: ^0.1.0
- @trokky/routes: ^2.0.0
- @trokky/mail: ^0.1.0
- @trokky/i18n: ^0.2.0
- @trokky/fields: ^0.4.0
- @trokky/studio: ^0.4.0
- @trokky/adapter-filesystem-data: ^2.0.0
- @trokky/adapter-filesystem-media: ^2.0.0
