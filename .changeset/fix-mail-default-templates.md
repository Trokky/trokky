---
"@trokky/express": patch
---

fix(express): use BuiltInTemplateRenderer as default when no templateRenderer provided

- Auto-create BuiltInTemplateRenderer with sensible defaults when mail config doesn't specify a custom templateRenderer
- Move @trokky/core and @trokky/mail to peerDependencies to fix npm link issues with shared singletons (adapter registry)
- The default template renderer uses:
  - brandName from studio.branding.title or "Trokky"
  - supportEmail from mail.defaultFrom
  - baseUrl from STUDIO_URL env var or localhost
