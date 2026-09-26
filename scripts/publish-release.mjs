/**
 * Publish the workspace packages to npm, one at a time, dependencies first.
 *
 * Authentication is npm trusted publishing: the workflow's OIDC token is exchanged for publish
 * rights, and npm attaches provenance. There is no NPM_TOKEN. Trusted publishing covers
 * `npm publish` only — not `npm dist-tag` — which is why this no longer publishes behind a
 * `staged` tag and promotes afterwards.
 *
 * The invariant that design protected still holds, by ordering instead. v3.2.0 went out with
 * `changeset publish` publishing every package at once: @trokky/studio was live depending on a
 * @trokky/trokky that had not landed and could not be installed. Here a package is published
 * only after each workspace package it depends on is confirmed readable on the registry. If a
 * publish fails, the ones before it are live and the ones after are not, and every live
 * dependent still points at a dependency that exists.
 *
 * Idempotent: a version already on the registry is skipped, so a failed release is recovered
 * by re-running the workflow.
 *
 * For each release it creates the git tag `<name>@<version>` and prints `New tag: <name>@<version>`:
 * changesets/action reads that line, pushes the tag and creates the GitHub release. It pushes a
 * tag that must exist locally — `changeset publish` used to create them, so this script must.
 * A version already on npm whose tag never reached GitHub (a run that failed after publishing)
 * gets its tag and release on the re-run.
 *
 * DRY_RUN=1 runs `npm publish --dry-run` and skips the registry wait.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DRY_RUN = process.env.DRY_RUN === '1'
/** npm is eventually consistent: an accepted version can take minutes to be readable. */
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS ?? 10 * 60 * 1000)
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 10 * 1000)

/**
 * Registry answers meaning "the version is there" rather than "the publish failed": a re-run
 * after a publish that was accepted but not yet readable.
 */
const ALREADY_THERE = /cannot publish over (the )?previously (staged|published) version/i

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

/** Whether the release tag exists here or on GitHub. */
function tagExists(tag) {
  try {
    git(['rev-parse', '-q', '--verify', `refs/tags/${tag}`])
    return true
  } catch {
    // Not local; the checkout may not have every tag
  }
  try {
    return git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]) !== ''
  } catch {
    return false
  }
}

/** Tag the release and announce it, so changesets/action pushes the tag and creates the release. */
function announce(pkg) {
  const tag = `${pkg.name}@${pkg.version}`
  if (DRY_RUN) {
    console.log(`(dry run) would tag and announce ${tag}`)
    return
  }
  try {
    git(['rev-parse', '-q', '--verify', `refs/tags/${tag}`])
  } catch {
    git(['tag', tag])
  }
  console.log(`New tag: ${tag}`)
}

/** Every publishable workspace package. */
function workspacePackages() {
  return readdirSync('packages', { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const manifestPath = join('packages', entry.name, 'package.json')
      if (!existsSync(manifestPath)) return null
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (manifest.private) return null
      const internal = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
      return { name: manifest.name, version: manifest.version, dir: entry.name, internal }
    })
    .filter(Boolean)
}

/** Dependencies first, computed rather than hardcoded so it cannot rot as packages are added. */
function inDependencyOrder(packages) {
  const names = new Set(packages.map(pkg => pkg.name))
  const ordered = []
  const placed = new Set()
  while (ordered.length < packages.length) {
    const next = packages.find(
      pkg => !placed.has(pkg.name) && pkg.internal.filter(name => names.has(name)).every(name => placed.has(name))
    )
    if (!next) {
      const stuck = packages.filter(pkg => !placed.has(pkg.name)).map(pkg => pkg.name)
      throw new Error(`Dependency cycle between workspace packages: ${stuck.join(', ')}`)
    }
    ordered.push(next)
    placed.add(next.name)
  }
  return ordered
}

/** Numeric semver compare on the release part; prerelease tags are not used here. */
function newerThan(a, b) {
  const pa = String(a).split('-')[0].split('.').map(Number)
  const pb = String(b).split('-')[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

/**
 * Returns `{ document }` on 200, `{ document: null }` on 404 (never published), and
 * `{ transient }` for anything else — in practice npm rate-limiting a shared runner IP.
 * Treating every non-OK answer as "not published" once cost a whole release's timeout.
 */
async function packument(name) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, {
      headers: { 'cache-control': 'no-cache', accept: 'application/json' }
    })
    if (response.status === 404) return { document: null }
    if (!response.ok) return { transient: response.status }
    return { document: await response.json() }
  } catch (error) {
    return { transient: error instanceof Error ? error.message : String(error) }
  }
}

async function packumentWithRetry(name, attempts = 6) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await packument(name)
    if (!('transient' in result)) return result.document
    last = result.transient
    const delay = Math.min(30_000, 2_000 * 2 ** (attempt - 1))
    console.log(`  registry read for ${name} failed transiently (${last}); retrying in ${delay / 1000}s`)
    await sleep(delay)
  }
  throw new Error(`Registry unreadable for ${name} after ${attempts} attempts (last: ${last}).`)
}

async function waitUntilReadable(pkg, outcome) {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  for (;;) {
    const result = await packument(pkg.name)
    if (!('transient' in result) && result.document?.versions?.[pkg.version]) return
    if (Date.now() >= deadline) {
      const wedged = outcome === 'already-there'
        ? ' npm answered that the version was already published or staged, yet it never appeared. ' +
          'That can be permanent (npm/cli#9889): if a re-run gives the same answer, release a new ' +
          'patch version instead.'
        : ' Re-run the workflow once npm settles: versions already on the registry are skipped.'
      throw new Error(
        `${pkg.name}@${pkg.version} is not readable on the registry after ${POLL_TIMEOUT_MS / 1000}s, ` +
        `so nothing that depends on it was published.${wedged}`
      )
    }
    console.log(`  waiting for ${pkg.name}@${pkg.version} to be readable...`)
    await sleep(POLL_INTERVAL_MS)
  }
}

function publish(pkg) {
  const args = ['publish', '--workspace', `packages/${pkg.dir}`, '--access', 'public']
  if (DRY_RUN) args.push('--dry-run')
  const result = spawnSync('npm', args, { encoding: 'utf8', env: process.env })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(output)
  if (result.error) {
    throw new Error(`Could not run npm publish for ${pkg.name}: ${result.error.message}`)
  }
  if (result.status === 0) return 'published'
  if (ALREADY_THERE.test(output)) return 'already-there'
  throw new Error(`npm publish failed for ${pkg.name}@${pkg.version} (exit ${result.status}). Stopping: the packages after it in the order above were not published.`)
}

async function main() {
  const packages = inDependencyOrder(workspacePackages())
  console.log(`Publish order: ${packages.map(pkg => `${pkg.name}@${pkg.version}`).join(' -> ')}`)

  // Decide everything before publishing anything, so a refusal cannot leave the fixed group
  // half released.
  const plan = []
  for (const pkg of packages) {
    const document = await packumentWithRetry(pkg.name)
    if (document?.versions?.[pkg.version]) {
      plan.push({ pkg, action: 'skip' })
      continue
    }
    // npm points `latest` at whatever was just published. Publishing a version older than the
    // current latest — a revert, a re-run on an old commit — would demote every user.
    const latest = document?.['dist-tags']?.latest
    if (latest && newerThan(latest, pkg.version)) {
      throw new Error(`${pkg.name}: latest is ${latest}, ahead of ${pkg.version}. Refusing to publish an older version over it; nothing was published.`)
    }
    plan.push({ pkg, action: 'publish' })
  }

  let published = 0
  for (const { pkg, action } of plan) {
    if (action === 'skip') {
      console.log(`${pkg.name}@${pkg.version} is already on the registry; skipping.`)
      // A run that failed after publishing left no tag or release; this one supplies them
      if (!tagExists(`${pkg.name}@${pkg.version}`)) announce(pkg)
      continue
    }
    console.log(`Publishing ${pkg.name}@${pkg.version}...`)
    const outcome = publish(pkg)
    if (!DRY_RUN) await waitUntilReadable(pkg, outcome)
    announce(pkg)
    published++
  }

  const verb = DRY_RUN ? 'Would publish' : 'Published'
  console.log(published === 0 ? 'Nothing to publish.' : `${verb} ${published} package(s).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
