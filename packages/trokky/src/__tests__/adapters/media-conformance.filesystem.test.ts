/**
 * The media conformance suite run against FilesystemMediaAdapter — the reference
 * implementation the contract was read off, and the one every site runs in production today.
 *
 * Each adapter gets its own directory under `.foreman/work/`, never os.tmpdir(), so a stray
 * run leaves its evidence where it can be found rather than scattered around the machine.
 */

import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { afterAll } from 'vitest'
import { FilesystemMediaAdapter } from '../../adapters/filesystem-media/filesystem-media-adapter.js'
import type { MediaStorageAdapter } from '../../core/types/storage-adapters.js'
import { describeMediaAdapterConformance } from './media-conformance.js'

const here = path.dirname(fileURLToPath(import.meta.url))
// here = <repo>/packages/trokky/src/__tests__/adapters -> five levels up is the repo root
const REPO_ROOT = path.resolve(here, '../../../../..')
const WORK_ROOT = path.join(REPO_ROOT, '.foreman', 'work', 'media-conformance-fs')

const dirsByAdapter = new Map<MediaStorageAdapter, string>()

async function createAdapter(): Promise<MediaStorageAdapter> {
  const mediaDir = path.join(WORK_ROOT, randomBytes(8).toString('hex'))
  await fs.mkdir(mediaDir, { recursive: true })

  const adapter = new FilesystemMediaAdapter({ mediaDir, silent: true })
  dirsByAdapter.set(adapter, mediaDir)
  await adapter.healthCheck()
  return adapter
}

async function teardown(adapter: MediaStorageAdapter): Promise<void> {
  await adapter.close?.()
  const mediaDir = dirsByAdapter.get(adapter)
  dirsByAdapter.delete(adapter)
  if (mediaDir) {
    await fs.rm(mediaDir, { recursive: true, force: true })
  }
}

afterAll(async () => {
  await fs.rm(WORK_ROOT, { recursive: true, force: true }).catch(() => undefined)
})

describeMediaAdapterConformance('FilesystemMediaAdapter', {
  createAdapter,
  teardown,
  capabilities: {
    // Everything the adapter reads off its own directory listing.
    listFilters: true
  }
})
