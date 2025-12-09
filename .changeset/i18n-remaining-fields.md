---
"@trokky/fields": minor
"@trokky/studio": minor
"@trokky/core": patch
"@trokky/i18n": patch
---

Complete i18n migration for remaining field components and modals

- Migrated all remaining field components to i18n:
  - BooleanField, ColorField, DateField, EmailField
  - GeoCoordinateField, IconField, InfoField, PasswordField
  - PortableTextField, RichTextField, SlugField
  - TextareaField, URLField
- Migrated ArrayModal and ObjectModal with modal-specific translations
- Added auto-field translation support in FieldWrapper (i18n: prefix)
- Updated schema registry to use i18n keys for auto-injected fields
- Added Featured Image and slug translations for auto-injected fields
- Migrated GoogleLoginButton with OAuth translations
