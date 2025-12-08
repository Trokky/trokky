---
"@trokky/i18n": minor
"@trokky/studio": minor
---

Add internationalization (i18n) support to Trokky

- Create new `@trokky/i18n` package with react-i18next integration
- Add English and French translations for Studio, fields, auth, and error messages
- Integrate i18n provider into Studio application
- Add language preference selector in User Preferences page
- Support automatic browser language detection with localStorage persistence

Key features:
- `TrokkyI18nProvider` component for wrapping applications
- `useT` hook for accessing translations with namespace support
- `useLocale` hook for managing language preferences
- `useErrorTranslation` hook for translating error codes
- `useFieldTranslation` hook for field-related translations
- Translation files organized by namespace: common, studio, fields, auth, errors
