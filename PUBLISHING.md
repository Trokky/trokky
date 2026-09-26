# Publishing Guide

How the Trokky packages are versioned and published to npm.

## Packages

| Directory | Published name | What it is |
|---|---|---|
| `packages/trokky` | `@trokky/trokky` | CMS server: engine, routes, adapters, mail, i18n, Express integration |
| `packages/studio` | `@trokky/studio` | React admin UI and field system |
| `packages/client` | `@trokky/client` | Frontend SDK: HTTP client, query builder, type generation |
| `packages/mcp` | `@trokky/mcp` | MCP server for AI agents (stdio, `npx @trokky/mcp`) |

All four are public on npm under the `@trokky` scope.

## One version for all of them

`.changeset/config.json` declares the packages as a `fixed` group, so any changeset bumps all of
them to the same version and they are released together. Use `patch` bumps only until told
otherwise. Never edit `version` by hand: `changeset version` does it.

## Releasing

1. Every change that should ship carries a changeset (`npx changeset`), merged with its PR.
2. On each push to `main` with pending changesets, the **Changesets Release** workflow opens or
   updates the **Release: Version Packages** PR.
3. Merging that PR is the release. The same workflow runs `npm run release`
   (`scripts/publish-release.mjs`).

The publish script sends one package at a time, dependencies first, and waits until each is
readable on the registry before publishing anything that depends on it. So a dependent is never
live before its dependency: that is how v3.2.0 broke, when every package went out at once. It
skips versions already on the registry and refuses to publish a version older than `latest`.

## Authentication: trusted publishing, no token

The workflow authenticates with npm **trusted publishing** (OIDC). GitHub issues a short-lived
token for the run, npm exchanges it for publish rights, and every release carries a provenance
attestation. There is no `NPM_TOKEN` secret. The 3.5.1 release first failed because the old
long-lived token had silently expired.

Each package's trusted publisher is configured on npmjs.com (package > Settings > Trusted
Publisher > GitHub Actions):

| Field | Value |
|---|---|
| Organization or user | `Trokky` |
| Repository | `trokky` |
| Workflow filename | `release-changesets.yml` |
| Environment | (empty) |

Two constraints follow from how npm implements this:

- **One workflow per package.** npm trusts a single workflow file, so there is no separate manual
  publish workflow. To recover, re-run the failed run or dispatch **Changesets Release** by hand.
  Both are safe, because published versions are skipped.
- **A new package cannot be configured until it exists.** The first version of a new package is
  published by a maintainer from their machine, then its trusted publisher is added:

  ```bash
  npm run build
  npm login
  npm publish --workspace packages/<dir> --access public
  ```

  The workflow skips that version afterwards, because it is already on the registry.

Trusted publishing needs npm 11.5.1 or later; the workflow installs it, since Node 22 ships npm 10.
It covers `npm publish` only, not `npm dist-tag`, which is why releases go straight to `latest`.

## When a release fails

Re-run the failed run, or dispatch **Changesets Release** from `main`. The script skips versions
already on npm, publishes the rest in order, and creates any git tag and GitHub release that a
failed run left out. One case a re-run cannot fix: npm answering that a version is "previously
staged" or "previously published" while it never becomes readable (npm/cli#9889). If a re-run
reports that again, release a new patch version.

## Verification

```bash
npm view @trokky/trokky dist-tags
npm view @trokky/mcp@<version> dist.attestations   # provenance, on OIDC-published versions
```

A green workflow is not proof that a site runs the new version. After deploying a site, check
that it serves the new bundle.
