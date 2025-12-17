---
"@trokky/studio": patch
"@trokky/express": patch
---

feat(captcha): add language option for Turnstile and reCAPTCHA widgets

Added `language` option to CaptchaConfig to allow setting the CAPTCHA widget language (e.g., 'fr', 'en'). This enables localization of Turnstile and reCAPTCHA widgets to match the application's locale.

- Added `language?: string` to CaptchaConfig options in @trokky/express
- Added `language` prop to CaptchaWidgetProps and Turnstile render options in @trokky/studio