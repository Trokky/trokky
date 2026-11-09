---
'@trokky/trokky': patch
---

The JWT signing key can no longer be missing or a placeholder in production without anyone noticing.

- In production Trokky refuses to start when no secret is set (`security.jwtSecret` or `TROKKY_JWT_SECRET`). It used to generate a random key without a word, so every restart signed everyone out and replicas rejected each other's tokens.
- It also refuses a placeholder: values such as `change-me-in-production`, `your-secret-key-here`, `replace-me`, `dev-secret-do-not-use-in-production` or a bare `secret`. Those come from examples, and anyone who has read the example can sign tokens for the site. A secret shorter than 32 characters is accepted with a warning; a blank one counts as missing.
- A real `TROKKY_JWT_SECRET` now wins over a placeholder fallback in config (`process.env.JWT_SECRET || 'change-me'`), so setting the variable the error names is enough.
- Production means: `env` in the config or `NODE_ENV` says production, or names anything other than development or test (`staging`, `prod`). A config left on `env: 'development'` no longer switches the check off on a server with `NODE_ENV=production`.
- Edge runtimes have no `NODE_ENV`: a Worker in production should pass `env: 'production'` to `TrokkyCore` to get the same check.
- The Express integration no longer supplies the fixed key `dev-secret-change-in-production` in development. It applied to any deployment without `NODE_ENV=production`, which made it a public signing key on such sites. Development now uses a random key per process and logs one warning: set `TROKKY_JWT_SECRET` in `.env` to keep Studio sessions across restarts.
- `defineConfig()` accepts `TROKKY_JWT_SECRET` as the production secret, like the engine does.
- The unused `DEFAULT_AUTH_CONFIG` export, which carried a hard-coded key, is removed.

Before upgrading a production site, make sure it sets a real secret. A config that falls back to a placeholder when its variable is unset will refuse to start until the variable is set.
