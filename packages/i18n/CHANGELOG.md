# @trokky/i18n

## 0.2.2

### Patch Changes

- 84a8782: Fix internal dependency version constraints

  Replace wildcard (\*) dependencies with proper semver constraints to prevent version mismatch issues when installing packages. This ensures that packages requiring features from specific versions (like expandDocumentReferences in @trokky/core@2.0.0) will correctly resolve to compatible versions.
  - @trokky/core: ^2.0.0
  - @trokky/types: ^0.1.0
  - @trokky/routes: ^2.0.0
  - @trokky/mail: ^0.1.0
  - @trokky/i18n: ^0.2.0
  - @trokky/fields: ^0.4.0
  - @trokky/studio: ^0.4.0
  - @trokky/adapter-filesystem-data: ^2.0.0
  - @trokky/adapter-filesystem-media: ^2.0.0

## 0.2.1

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

- Updated dependencies [3f58a2a]
- Updated dependencies [fd7f1d8]
  - @trokky/types@0.1.1

## 0.2.0

### Minor Changes

- 7a0441b: Add internationalization (i18n) support to Trokky
  - Create new `@trokky/i18n` package with react-i18next integration
  - Add English and French translations for Studio, fields, auth, and error messages
  - Integrate i18n provider into Studio application
  - Add language preference selector in User Preferences page
  - Support automatic browser language detection with localStorage persistence
  - Add i18n configuration support to `trokky.config.ts`

  Configuration example:

  ```typescript
  // trokky.config.ts
  export default {
    // ... other config
    i18n: {
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr'],
      fallbackLocale: 'en',
      detectBrowserLanguage: true,
      debug: false,
    },
  }
  ```

  Key features:
  - `TrokkyI18nProvider` component for wrapping applications
  - `useT` hook for accessing translations with namespace support
  - `useLocale` hook for managing language preferences
  - `useErrorTranslation` hook for translating error codes
  - `useFieldTranslation` hook for field-related translations
  - Translation files organized by namespace: common, studio, fields, auth, errors
  - Configuration propagates from `trokky.config.ts` through Express to Studio

### Patch Changes

- 119d983: Refactor pluralization to use i18next built-in support
  - ArrayField: Use `itemCount` with count parameter for proper pluralization
  - ArrayField preview: Add i18n support and use proper pluralization
  - ReferenceField: Use `references` with count parameter for proper pluralization
  - WebhookManagement: Use `eventsCount` with proper pluralization
  - ContentViewControls: Fix French pluralization for selected items count
  - Add `selectedOfTotal_one` and `selectedOfTotal_other` keys for French singular/plural
  - Header: Widen user dropdown menu to accommodate longer translations
  - French translations: Fix missing accents (é, è, ê, ç, à, etc.) across all locale files

- 4351835: Complete i18n migration for remaining field components and modals
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
