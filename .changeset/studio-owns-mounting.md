---
"@trokky/trokky": major
"@trokky/studio": major
"@trokky/client": major
---

Studio mounts itself. The server no longer serves the admin UI, and the dependency cycle between `@trokky/trokky` and `@trokky/studio` is gone.

**Before**, the server auto-mounted Studio from `config.studio` by dynamically importing `@trokky/studio/dist/server/assets.js`, a build artifact, behind a type-check suppression, and served a 404 in silence when that import failed. **Now** a site mounts Studio like any other router:

```ts
import { studioRouter } from '@trokky/studio/express'

const server = await startServer(config)
server.app.use('/studio', studioRouter({ apiPath: '/api' }))
```

Mount it before any catch-all (your Astro handler, `express.static`). The router serves the built SPA and injects only the bootstrap the UI needs: the API path, the mount path (read from `req.baseUrl`, so any prefix works), an optional explicit `backendUrl` for proxies that rewrite the Host header, and optional branding and i18n defaults for the login screen. Everything else Studio already fetches from the API. It mounts on Express 4 and 5.

**Config changes, all refused with a message naming the fix:**

- `studio.structure` moves to the top-level `structure`. The server reads it for singleton enforcement and the boot-time consistency check, so it was never only Studio's.
- `studio.enabled`, `studio.path`, `studio.apiUrl` and `studio.requireAuth` are gone. The last two never did anything.
- `studio.branding`, `studio.fields`, `studio.settings` and `studio.session` stay: they are served to the UI over `GET /config/studio`.
- `mount()` no longer takes `studioPath`; `getMountedPaths()` returns only `apiPath`; `getInfo()` no longer reports `studioPath` or `studioEnabled`.
- The device-flow approval URL is configurable as `oauth2.verificationUri`, defaulting to `${issuer}/studio/auth/device` as before.

`@trokky/trokky` drops its optional peer dependency on `@trokky/studio`. `@trokky/studio` still depends on `@trokky/trokky` for types and translations, which is the normal direction. `@trokky/studio` gains the `./express` entry and loses the `./dist/server/assets.js` export.
