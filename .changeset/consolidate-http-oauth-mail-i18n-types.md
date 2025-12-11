---
"@trokky/types": patch
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/mail": patch
"@trokky/i18n": patch
---

Consolidate HTTP, OAuth2, Mail, and i18n types into @trokky/types

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
