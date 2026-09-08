# Publishing Guide

How the Trokky packages are versioned and published to GitHub Packages.

## Packages

The monorepo publishes exactly three packages.

| Directory | Published name | What it is |
|---|---|---|
| `packages/trokky` | `@trokky/trokky` | CMS server: engine, routes, adapters, mail, i18n, Express integration |
| `packages/studio` | `@trokky/studio` | React admin UI and field system |
| `packages/client` | `@trokky/client` | Frontend SDK: HTTP client, query builder, type generation |

All three are currently at `2.0.0`.

## One version for all three

`.changeset/config.json` declares the three packages as a `fixed` group:

```json
"fixed": [["@trokky/trokky", "@trokky/studio", "@trokky/client"]]
```

A changeset that touches a single package therefore bumps all three to the same
new version, and all three are published together. Never edit `version` fields in
`package.json` by hand; let `changeset version` do it.

Internal dependency ranges are kept at `^2.0.0`:

- `@trokky/trokky` is a dependency of `@trokky/studio` and `@trokky/client`
- `@trokky/studio` is a peer dependency of `@trokky/trokky`

## Registry decision: why `@trokky/trokky`

The packages are hosted on GitHub Packages, where
[the npm registry docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
state:

> GitHub Packages only supports scoped npm packages.

The server package therefore cannot be published as a bare `trokky`; it is
published as `@trokky/trokky`. The repository itself stays private, and packages
are published with `access: restricted`
(`publishConfig` in each `package.json` and `access` in the changesets config).

### Consumer setup

Consumers need an `.npmrc` pointing the scope at GitHub Packages and a token with
`read:packages`:

```
@trokky:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
export NODE_AUTH_TOKEN=<github token with read:packages>
npm install @trokky/trokky @trokky/studio @trokky/client
```

The repository root has the same `.npmrc`, so local development resolves the
scope correctly too.

## Publishing methods

### 1. Automated release PR (recommended)

1. Make your code changes.
2. Create a changeset: `npx changeset` (or write `.changeset/<name>.md` by hand).
3. Commit code and changeset together, push to `main`.
4. `.github/workflows/release-changesets.yml` opens a "Release: Version Packages"
   PR containing the version bumps and CHANGELOG entries.
5. Merging that PR runs `npm run release` (`turbo build && changeset publish`),
   which publishes all three packages and creates GitHub Releases.

### 2. Manual Publish workflow

Use when a release needs to go out without the release PR flow (re-publishing a
failed release, a hotfix on already-versioned packages).

GitHub repo > Actions > "Manual Publish" > Run workflow, with inputs:

- `package`: `all` (default), `trokky`, `studio` or `client`
- `dry_run`: boolean, default `false`; when `true`, `--dry-run` is appended to
  every `npm publish` so nothing is actually uploaded

The workflow builds, then for each selected package checks
`npm view <name>@<version>` and skips it if that exact version already exists on
the registry. With `all` it publishes in dependency order: `trokky`, then
`client`, then `studio`.

### 3. Local CLI

Last resort, for debugging or when Actions is unavailable.

```bash
npm run build
npm run version-packages        # consumes changesets, bumps all three
git commit -m "chore(release): version packages"
export NODE_AUTH_TOKEN=<github token with write:packages>
npm publish --workspace packages/trokky --access restricted
npm publish --workspace packages/client --access restricted
npm publish --workspace packages/studio --access restricted
```

Publish order is always `trokky` -> `client` -> `studio`, so dependents never
resolve against a version that is not on the registry yet.

## Verification

```bash
npm view @trokky/trokky version
npm view @trokky/studio versions
npm publish --dry-run --workspaces   # inspect the tarballs without publishing
```

## Common issues

**401 Unauthorized** - the token is missing or lacks `write:packages`. Set
`NODE_AUTH_TOKEN` before publishing.

**"version already exists"** - that version is on the registry. Create a
changeset and run `npm run version-packages` to bump; the Manual Publish
workflow skips such packages instead of failing.

**Changeset file disappeared after `version-packages`** - expected. It was
converted into version bumps and CHANGELOG entries.

**Stale Turbo build output** - `npx turbo clean && npm run build`.

## References

- [Changesets](https://github.com/changesets/changesets)
- [GitHub Packages npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Semantic Versioning](https://semver.org/)
