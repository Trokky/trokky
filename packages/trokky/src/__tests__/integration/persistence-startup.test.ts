/**
 * TrokkyExpress.create runs the persistence check in production only, on the directories of the
 * filesystem adapters it was configured with. The mount-table logic itself is in persistence.test.ts.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const check = vi.hoisted(() => vi.fn(async (dirs: Array<{ label: string; dir: string }>) => dirs.map((d) => `EPHEMERAL ${d.label} ${d.dir}`)))
vi.mock('../../integrations/express/persistence.js', () => ({ findEphemeralDirectories: check }))

import '../../adapters/filesystem-data/index.js'
import '../../adapters/filesystem-media/index.js'
import { TrokkyExpress } from '../../integrations/express/index.js'

const dir = path.join(os.tmpdir(), `trokky-persist-${process.pid}`)
const config = (env: 'production' | 'development') =>
  ({
    env,
    schemas: [{ name: 'post', type: 'document', fields: { title: { type: 'string' } } }],
    security: { jwtSecret: 'k3Jx9pQ2vL7mN4rT8wY1zA6bC5dE0fGhIjKlMnOp' },
    storage: {
      data: { adapter: 'filesystem-data', options: { contentDir: `${dir}/content`, usersDir: `${dir}/users`, tokensDir: `${dir}/tokens`, settingsDir: `${dir}/settings`, webhooksDir: `${dir}/webhooks`, authFlowStateDir: `${dir}/flow`, auditLogsDir: `${dir}/audit` } },
      media: { adapter: 'filesystem-media', options: { mediaDir: `${dir}/media` } },
    },
  }) as never

const warned = () => vi.mocked(console.warn).mock.calls.flat().map(String).filter((line) => line.includes('EPHEMERAL'))

describe('persistence check at startup', () => {
  beforeAll(async () => {
    await fs.promises.mkdir(dir, { recursive: true })
  })

  afterAll(async () => {
    await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  })

  beforeEach(() => {
    check.mockClear()
    vi.mocked(console.warn).mockClear()
  })

  it('should check the configured directories and log each finding in production', async () => {
    const trokky = await TrokkyExpress.create(config('production'))
    expect(check).toHaveBeenCalledWith([
      { label: 'Documents', dir: `${dir}/content` },
      { label: 'Users', dir: `${dir}/users` },
      { label: 'API tokens', dir: `${dir}/tokens` },
      { label: 'Settings', dir: `${dir}/settings` },
      { label: 'Webhooks', dir: `${dir}/webhooks` },
      { label: 'Sign-in flow state', dir: `${dir}/flow` },
      { label: 'Audit logs', dir: `${dir}/audit` },
      { label: 'Media files', dir: `${dir}/media` },
    ])
    expect(warned()).toHaveLength(8)
    await trokky.shutdown?.()
  })

  it('should check the default directories a site did not configure', async () => {
    // createDirs: false so the relative defaults are named but nothing is created in the cwd
    const bare = config('production') as unknown as { storage: { data: { options: object }; media: { options: object } } }
    bare.storage.data.options = { createDirs: false }
    bare.storage.media.options = { createDirs: false }
    const trokky = await TrokkyExpress.create(bare as never)
    const dirs = check.mock.calls[0][0].map((d: { dir: string }) => d.dir)
    expect(dirs).toEqual(['./content', './users', './tokens', './settings', './webhooks', './auth-flow-state', './audit-logs', './media'])
    await trokky.shutdown?.()
  })

  it('should run when NODE_ENV says production even if the config says development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const trokky = await TrokkyExpress.create(config('development'))
      expect(check).toHaveBeenCalledOnce()
      await trokky.shutdown?.()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('should not run in development', async () => {
    const trokky = await TrokkyExpress.create(config('development'))
    expect(check).not.toHaveBeenCalled()
    await trokky.shutdown?.()
  })
})
