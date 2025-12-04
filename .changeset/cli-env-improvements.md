---
"@trokky/trokky": patch
---

fix(cli): improve generated project configuration

- Add captcha support (Turnstile/reCAPTCHA) with new --captcha CLI option
- Load dotenv at the top of generated trokky.config.ts before other imports
- Use conditional getMailConfig() function that checks TROKKY_MAIL_ENABLED
- Make OAuth conditional (only enabled if GOOGLE_CLIENT_ID exists)
- Make captcha conditional (only enabled if secret key env var exists)
- Add @trokky/studio to dependencies for embedded studio
- Add @trokky/mail-adapter-console as fallback when resend is selected
- Fix schema type: use 'document' instead of deprecated 'collection'
- Add complete email env vars: EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_REPLY_TO, TROKKY_MAIL_ENABLED, TROKKY_MAIL_PROVIDER
- Add STUDIO_URL env var
