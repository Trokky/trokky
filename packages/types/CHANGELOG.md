# @trokky/types

## 0.1.1

### Patch Changes

- 3f58a2a: Consolidate HTTP, OAuth2, Mail, and i18n types into @trokky/types
  - Added http.ts with HttpMethod, HttpRequest, HttpResponse, ApiResponse, FrameworkAdapter types
  - Added api-requests.ts with all document, media, user, auth, and webhook request types
  - Added oauth2.ts with full OAuth2 authorization server types (RFC 8628 Device Flow, PKCE)
  - Added mail.ts with MailAdapter, MailMessage, MailResult, and provider config types
  - Added i18n.ts with SupportedLocale, I18nConfig, LanguagePreference types
  - Updated @trokky/core to re-export OAuth2 types from @trokky/types
  - Updated @trokky/routes to re-export HTTP and API request types from @trokky/types
  - Updated @trokky/mail to re-export mail types from @trokky/types
  - Updated @trokky/i18n to re-export i18n types from @trokky/types
  - Added subpath exports for /http, /api-requests, /oauth2, /mail, /i18n

- fd7f1d8: refactor(types): Consolidate shared types into @trokky/types

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
