---
"@trokky/types": patch
"@trokky/routes": patch
"@trokky/fields": patch
"@trokky/mail": patch
"@trokky/mail-adapter-console": patch
"@trokky/mail-adapter-resend": patch
"@trokky/mail-adapter-smtp": patch
---

refactor(types): Consolidate shared types into @trokky/types

Centralizes type definitions to eliminate duplication across packages.

Slug Types:
- Add `slug.ts` with consolidated slug types (SlugifyOptions, SlugFieldConfig, SlugFieldValue, SlugFieldOptions)
- Add subpath export `@trokky/types/slug` for direct imports
- Update @trokky/routes and @trokky/fields to import from @trokky/types

Field System Types:
- Add `field-system.ts` with 14 core field system types:
  - ConditionalOperator, ConditionalConfig (conditional visibility)
  - ValidationResult, BaseValidation, ValidationState (validation)
  - FieldCategory, BaseFieldOptions, BaseFieldDefinition, BaseFieldValue (field definitions)
  - DocumentContext (document context)
  - FieldPluginSource, BaseFieldPlugin, BaseRegisteredFieldPlugin (plugin types without React deps)
- Add subpath export `@trokky/types/field-system` for direct imports
- Update @trokky/fields to import and re-export from @trokky/types

Other Changes:
- Add @trokky/types as dependency to @trokky/routes
- Fix broken test scripts in mail packages (removed non-functional jest commands)
- Remove outdated package filters from root package.json test/lint scripts

This refactoring improves type consistency across the Trokky ecosystem by maintaining a single source of truth for shared types.
