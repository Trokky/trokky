/**
 * The storage conformance suite run against FilesystemDataAdapter.
 *
 * Every adapter gets its own temp directory, and that directory lives inside the repo under
 * `.foreman/work/` — never os.tmpdir() — so a stray run leaves its evidence where it can be
 * found and cleaned up rather than scattered around the machine.
 */

import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { afterAll } from 'vitest'
import { FilesystemDataAdapter } from '../../adapters/filesystem-data/filesystem-data-adapter.js'
import type { DataStorageAdapter } from '../../core/types/storage-adapters.js'
import { describeDataAdapterConformance } from './conformance.js'

const here = path.dirname(fileURLToPath(import.meta.url))
// here = <repo>/packages/trokky/src/__tests__/adapters -> five levels up is the repo root
const REPO_ROOT = path.resolve(here, '../../../../..')
const WORK_ROOT = path.join(REPO_ROOT, '.foreman', 'work', 'conformance-fs')

const dirsByAdapter = new Map<DataStorageAdapter, string>()

async function createAdapter(): Promise<DataStorageAdapter> {
  const root = path.join(WORK_ROOT, randomBytes(8).toString('hex'))
  for (const dir of ['content', 'users', 'tokens', 'webhooks', 'settings', 'audit-logs']) {
    await fs.mkdir(path.join(root, dir), { recursive: true })
  }

  const adapter = new FilesystemDataAdapter({
    contentDir: path.join(root, 'content'),
    usersDir: path.join(root, 'users'),
    tokensDir: path.join(root, 'tokens'),
    webhooksDir: path.join(root, 'webhooks'),
    settingsDir: path.join(root, 'settings'),
    auditLogsDir: path.join(root, 'audit-logs'),
    silent: true
  })

  dirsByAdapter.set(adapter, root)
  await adapter.healthCheck()
  return adapter
}

async function teardown(adapter: DataStorageAdapter): Promise<void> {
  await adapter.close?.()
  const root = dirsByAdapter.get(adapter)
  dirsByAdapter.delete(adapter)
  if (root) {
    await fs.rm(root, { recursive: true, force: true })
  }
}

afterAll(async () => {
  // The per-adapter roots are already gone; drop the shared parent if nothing else is using it.
  await fs.rm(WORK_ROOT, { recursive: true, force: true }).catch(() => undefined)
})

describeDataAdapterConformance('FilesystemDataAdapter', { createAdapter, teardown })
