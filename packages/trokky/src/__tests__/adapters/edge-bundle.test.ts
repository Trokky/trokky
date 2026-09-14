/**
 * The package must bundle for Cloudflare Workers without the caller doing anything about
 * optional Node dependencies.
 *
 * This is a regression test for a failure no unit test could see. `sharp`, `pg` and `bcrypt`
 * are optional dependencies that never execute on Workers, and the code loading them sat behind
 * a dynamic `import()` for exactly that reason — but a bundler resolves a literal dynamic import
 * whether or not the branch runs, and the surviving reference broke the Worker before any code
 * executed. sharp pulls in `detect-libc`, which wants `fs` and `child_process`.
 *
 * Hiding the specifier behind a variable is not a fix either: workerd rejects a non-literal
 * dynamic specifier at parse time, executed or not. The reference has to be absent from the
 * bundle, which is why those modules are loaded through `require` today.
 *
 * Both halves are asserted below, from esbuild's own metadata rather than from the output text.
 */

import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../..')

/** What a Worker actually imports: the core, the fetch handler, and the Cloudflare adapters. */
const ENTRY = `
  export { TrokkyCore } from ${JSON.stringify(path.join(SRC, 'core/index.ts'))}
  export { createFetchHandler } from ${JSON.stringify(path.join(SRC, 'integrations/workers/index.ts'))}
  export { CloudflareD1Adapter } from ${JSON.stringify(path.join(SRC, 'adapters/cloudflare-d1/index.ts'))}
  export { CloudflareR2Adapter } from ${JSON.stringify(path.join(SRC, 'adapters/cloudflare-r2/index.ts'))}
`

/**
 * Node built-ins the core imports directly — `crypto` and `events` and `module` — which is why a
 * Worker needs the `nodejs_compat` flag. That is documented and expected. What must not appear is
 * an npm package with native bindings following them in.
 */
const ALLOWED_EXTERNALS = new Set([
  'crypto', 'events', 'module', 'fs', 'path', 'child_process', 'os', 'util',
  'stream', 'buffer', 'url', 'http', 'https', 'net', 'tls', 'zlib'
])

async function bundleForWorkerd() {
  return build({
    stdin: { contents: ENTRY, resolveDir: SRC, loader: 'ts' },
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*', ...ALLOWED_EXTERNALS],
    logLevel: 'silent'
  })
}

describe('edge bundle', () => {
  it('bundles for workerd with no unresolved dependency', async () => {
    const result = await bundleForWorkerd()
    expect(result.errors).toEqual([])
  }, 60_000)

  it('leaves nothing external but Node built-ins', async () => {
    const result = await bundleForWorkerd()

    const output = Object.values(result.metafile.outputs)[0]
    const unexpected = output.imports
      .filter(entry => entry.external)
      .map(entry => entry.path.replace(/^node:/, ''))
      .filter(specifier => !ALLOWED_EXTERNALS.has(specifier))

    // A surviving `sharp` here is the exact failure this test exists for: the Worker would fail
    // to start with "no matching module rules", long before a request arrives.
    expect(unexpected).toEqual([])
  }, 60_000)

  it('contains no dynamic import that workerd would refuse to parse', async () => {
    const result = await bundleForWorkerd()

    // workerd rejects `import(someVariable)` at parse time, whether or not the branch runs, so
    // hiding a specifier behind a variable trades one startup failure for another. esbuild gives
    // no usable signal for this — it bundles cleanly and stays silent — so the check reads the
    // Trokky sources that actually landed in the bundle and looks for a non-literal specifier.
    const ownSources = Object.keys(result.metafile.inputs).filter(
      input => !input.includes('node_modules') && /\.tsx?$/.test(input)
    )
    expect(ownSources.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const input of ownSources) {
      const source = await readFile(path.resolve(input), 'utf-8')
      // A dynamic import whose first argument does not start with a quote.
      for (const match of source.matchAll(/(?<![.\w$])import\s*\(\s*(['"`]?)/g)) {
        if (match[1] === '') offenders.push(`${input}: ${source.slice(match.index, match.index! + 60)}`)
      }
    }

    expect(offenders).toEqual([])
  }, 60_000)
})
