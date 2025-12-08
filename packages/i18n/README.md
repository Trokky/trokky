# @trokky/i18n

Internationalization (i18n) support for Trokky CMS. Provides translation utilities, React hooks, and a provider component for multi-language support in the Studio and custom applications.

## Installation

```bash
npm install @trokky/i18n
```

## Quick Start

### 1. Configure i18n in trokky.config.ts

```typescript
// trokky.config.ts
import { defineConfig } from '@trokky/express'

export default defineConfig({
  // ... other config
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr'],
    fallbackLocale: 'en',
    detectBrowserLanguage: true,
    debug: false,
  },
})
```

### 2. Wrap your application with the provider

For custom applications outside the Studio:

```tsx
import { TrokkyI18nProvider } from '@trokky/i18n'

function App() {
  return (
    <TrokkyI18nProvider
      config={{
        defaultLocale: 'en',
        supportedLocales: ['en', 'fr'],
        detectBrowserLanguage: true,
      }}
    >
      <YourApp />
    </TrokkyI18nProvider>
  )
}
```

Note: The Trokky Studio automatically wraps itself with the provider and reads configuration from `trokky.config.ts`.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultLocale` | `string` | `'en'` | The default language to use |
| `supportedLocales` | `string[]` | `['en', 'fr']` | List of supported language codes |
| `fallbackLocale` | `string` | `'en'` | Fallback language when translation is missing |
| `detectBrowserLanguage` | `boolean` | `true` | Auto-detect user's browser language |
| `debug` | `boolean` | `false` | Enable i18next debug logging |

## Hooks

### useT

Primary hook for translations. Returns a translation function.

```tsx
import { useT } from '@trokky/i18n'

function MyComponent() {
  const t = useT()

  return (
    <div>
      <h1>{t('common:welcome')}</h1>
      <p>{t('common:greeting', { name: 'John' })}</p>
    </div>
  )
}
```

### useLocale

Hook for managing the current locale.

```tsx
import { useLocale } from '@trokky/i18n'

function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales } = useLocale()

  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      {supportedLocales.map((lang) => (
        <option key={lang} value={lang}>{lang.toUpperCase()}</option>
      ))}
    </select>
  )
}
```

### useErrorTranslation

Specialized hook for translating error messages.

```tsx
import { useErrorTranslation } from '@trokky/i18n'

function ErrorDisplay({ error }) {
  const { translateError } = useErrorTranslation()

  return <div className="error">{translateError(error.code)}</div>
}
```

### useFieldTranslation

Specialized hook for translating field labels and descriptions.

```tsx
import { useFieldTranslation } from '@trokky/i18n'

function FieldLabel({ fieldType }) {
  const { translateFieldLabel } = useFieldTranslation()

  return <label>{translateFieldLabel(fieldType)}</label>
}
```

## Translation Namespaces

Translations are organized into namespaces:

| Namespace | Description |
|-----------|-------------|
| `common` | General UI strings (buttons, labels, messages) |
| `studio` | Studio-specific interface strings |
| `fields` | Field type labels and descriptions |
| `auth` | Authentication-related messages |
| `errors` | Error messages and validation errors |

### Using namespaces

```tsx
const t = useT()

// Explicit namespace
t('common:save')
t('studio:dashboard.title')
t('errors:validation.required')

// With interpolation
t('common:itemCount', { count: 5 })
```

## Adding Translations

Translation files are located in `packages/i18n/locales/{locale}/`:

```
locales/
  en/
    common.json
    studio.json
    fields.json
    auth.json
    errors.json
  fr/
    common.json
    studio.json
    fields.json
    auth.json
    errors.json
```

### Translation file format

```json
{
  "welcome": "Welcome",
  "greeting": "Hello, {{name}}!",
  "items": {
    "one": "{{count}} item",
    "other": "{{count}} items"
  }
}
```

## Supported Languages

Currently supported languages:
- English (`en`)
- French (`fr`)

## Language Persistence

The user's language preference is automatically saved to `localStorage` under the key `trokky-locale` and restored on subsequent visits.

## TypeScript Support

The package exports TypeScript types for configuration:

```typescript
import type { I18nConfig, SupportedLocale, TranslationNamespace } from '@trokky/i18n'

const config: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en', 'fr'],
}
```
