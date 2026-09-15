/**
 * Verify a release actually reached npm, then move `latest` onto it.
 *
 * The release publishes to a holding dist-tag rather than straight to `latest`. This script is
 * the second half: it confirms every package is really on the registry and only then promotes
 * them, dependency-first.
 *
 * It exists because of what v3.2.0 did. `changeset publish` publishes concurrently with no
 * dependency ordering — all three packages started within half a millisecond of each other, in
 * reverse dependency order — and it reported "packages published successfully" for all three
 * when only one had landed. `@trokky/studio@3.2.0` went live pointing at `@trokky/trokky@^3.2.0`,
 * which did not exist, so installing Studio failed outright until the core was finally
 * unstuck several minutes later.
 *
 * Publishing behind a holding tag means `latest` keeps pointing at the last complete release
 * while that is going on, so a half-finished publish is invisible to anyone installing. The
 * failure mode becomes "the new version exists but nobody is served it yet", which is recoverable
 * with a dist-tag change, instead of "the new version is served and cannot be installed".
 *
 * It reads the workspace manifests rather than the changesets action's list of published
 * packages, because that list is parsed from the publish command's output and comes back
 * incomplete exactly when it matters — when npm answered E409 for a staged version, which means
 * the publish succeeded but printed an error. The versions committed on main are the release, so
 * they are the authority.
 *
 * It is a no-op when every package's `latest` already matches its manifest, so it is safe to run
 * on any push to main.
 *
 * Set DRY_RUN=1 to run every check and print the promotions without moving any dist-tag.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** npm is eventually consistent, and a staged version can take minutes to appear. */
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS ?? 6 * 60 * 1000)
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 10 * 1000)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** Every publishable workspace package, at the version committed on this branch. */
function workspacePackages() {
  return readdirSync('packages', { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const manifestPath = join('packages', entry.name, 'package.json')
      if (!existsSync(manifestPath)) return null
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (manifest.private) return null
      return { name: manifest.name, version: manifest.version, dir: entry.name }
    })
    .filter(Boolean)
}

/** Read the registry once, bypassing any cache, for both the version list and dist-tags. */
async function packument(name) {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, {
    headers: { 'cache-control': 'no-cache' }
  })
  if (!response.ok) return null
  return response.json()
}

/**
 * Ask the registry directly rather than `npm view`, which reads a cached packument and will
 * happily report a version missing for a long time after it landed.
 */
async function isOnRegistry(name, version) {
  const document = await packument(name)
  return Boolean(document?.versions?.[version])
}

async function waitForAll(packages) {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let pending = [...packages]

  while (pending.length > 0) {
    const stillPending = []
    for (const pkg of pending) {
      if (await isOnRegistry(pkg.name, pkg.version)) {
        console.log(`  on registry: ${pkg.name}@${pkg.version}`)
      } else {
        stillPending.push(pkg)
      }
    }
    pending = stillPending
    if (pending.length === 0) break

    if (Date.now() >= deadline) {
      const missing = pending.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')
      throw new Error(
        `Not on the registry after ${POLL_TIMEOUT_MS / 1000}s: ${missing}\n` +
        `'latest' has NOT been moved, so users are still served the previous release.\n` +
        `Re-run this workflow once npm settles: changeset publish skips what is already there.`
      )
    }
    console.log(`  waiting for ${pending.length} package(s)...`)
    await sleep(POLL_INTERVAL_MS)
  }
}

/**
 * Dependency order, computed rather than hardcoded so it cannot rot as packages are added.
 * A package is promoted only after everything it depends on, so `latest` never points at a
 * release whose dependencies are not yet served.
 */
function inDependencyOrder(packages) {
  const names = new Set(packages.map(pkg => pkg.name))
  const dependencies = new Map()

  for (const pkg of packages) {
    const manifest = JSON.parse(readFileSync(join('packages', pkg.dir, 'package.json'), 'utf8'))
    const own = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
    dependencies.set(pkg.name, own.filter(name => names.has(name)))
  }

  const ordered = []
  const placed = new Set()
  while (ordered.length < packages.length) {
    const next = packages.find(
      pkg => !placed.has(pkg.name) && dependencies.get(pkg.name).every(name => placed.has(name))
    )
    // A cycle would loop forever; publishing in input order is no worse than failing here.
    if (!next) {
      return [...ordered, ...packages.filter(pkg => !placed.has(pkg.name))]
    }
    ordered.push(next)
    placed.add(next.name)
  }
  return ordered
}

const dryRun = process.env.DRY_RUN === '1'

function promote(name, version) {
  console.log(`  latest -> ${name}@${version}${dryRun ? ' (dry run)' : ''}`)
  if (dryRun) return
  execFileSync('npm', ['dist-tag', 'add', `${name}@${version}`, 'latest'], { stdio: 'inherit' })
}

const all = workspacePackages()

// Anything already served at its manifest version needs nothing; that is every ordinary push.
const pending = []
for (const pkg of all) {
  const document = await packument(pkg.name)
  if (document?.['dist-tags']?.latest === pkg.version) {
    console.log(`${pkg.name}@${pkg.version} is already latest.`)
  } else {
    pending.push(pkg)
  }
}

if (pending.length === 0) {
  console.log('Nothing to promote.')
  process.exit(0)
}

console.log(`Verifying ${pending.length} package(s) reached npm...`)
await waitForAll(pending)

console.log('Promoting to latest, dependencies first...')
for (const pkg of inDependencyOrder(pending)) {
  promote(pkg.name, pkg.version)
}

if (dryRun) {
  console.log('Dry run: latest was not moved.')
  process.exit(0)
}

console.log('Confirming latest now resolves...')
const wrong = []
for (const pkg of pending) {
  const document = await packument(pkg.name)
  const latest = document?.['dist-tags']?.latest
  console.log(`  ${pkg.name}: latest=${latest}`)
  if (latest !== pkg.version) wrong.push(`${pkg.name} is ${latest}, expected ${pkg.version}`)
}
if (wrong.length > 0) {
  throw new Error(`dist-tag promotion did not take effect:\n  ${wrong.join('\n  ')}`)
}

console.log('Release promoted.')
