---
"@trokky/trokky": patch
---

Add --i18n option to `trokky create` scaffolding command

- Add i18n mode selection (none, en, fr, en-fr) during project creation
- Include @trokky/i18n package dependency when i18n is enabled
- Generate i18n configuration in trokky.config.ts
- Add i18n info to .env.example
- Default: none for minimal/api-only templates, en-fr for full template
