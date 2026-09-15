/**
 * Run `changeset publish`, and do not fail the release when npm says a version is already staged.
 *
 * `E409 Cannot publish over previously staged version` does not mean the publish failed. It means
 * the registry **accepted the tarball** and has not yet moved it onto the public read path. The
 * version is on its way; a retry cannot help and only repeats the same error.
 *
 * Treating that as a failure is what broke the v3.2.0 release run: the publish step exited
 * non-zero, the job stopped, and nothing went on to check whether the packages had in fact
 * landed — which they had, moments later. So a staged conflict is reported and swallowed here,
 * and `promote-release.mjs` decides what is actually true by asking the registry.
 *
 * Every other publish error still fails the job.
 */

import { spawnSync } from 'node:child_process'

/** The registry's own wording, matched loosely because the phrasing has varied. */
const STAGED_CONFLICT = /cannot publish over (the )?previously staged version/i

const result = spawnSync('npx', ['changeset', 'publish', '--tag', 'staged'], {
  encoding: 'utf8',
  env: process.env
})

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
process.stdout.write(output)

if (result.error) {
  console.error(`Could not run changeset publish: ${result.error.message}`)
  process.exit(1)
}

if (result.status === 0) {
  process.exit(0)
}

if (STAGED_CONFLICT.test(output)) {
  console.log(
    '\nnpm reported a previously staged version. That means the tarball was accepted and is ' +
    'not yet on the public read path, not that publishing failed.\n' +
    'Continuing: promote-release will confirm against the registry before moving latest.'
  )
  process.exit(0)
}

process.exit(result.status ?? 1)
