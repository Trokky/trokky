import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FilesystemDataAdapter } from '../../adapters/filesystem-data/filesystem-data-adapter.js'
import type { AuthFlowState } from '../../core/types/storage-adapters.js'

/**
 * Exercises the real adapter rather than a stand-in. A fake that mirrors the
 * intended semantics cannot tell you whether the adapter implements them, or
 * even whether the method exists: these are optional interface members, so a
 * missing one is not a type error and falls back to in-process storage.
 */
describe('FilesystemDataAdapter auth flow state', () => {
  let dir: string
  let adapter: FilesystemDataAdapter

  const stateFor = (id: string, ttlMs = 60_000, kind: AuthFlowState['kind'] = 'oauth'): AuthFlowState => ({
    id,
    kind,
    data: { codeVerifier: 'placeholder-verifier' },
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  })

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-auth-flow-'))
    adapter = new FilesystemDataAdapter({
      contentDir: path.join(dir, 'content'),
      usersDir: path.join(dir, 'users'),
      tokensDir: path.join(dir, 'tokens'),
      authFlowStateDir: path.join(dir, 'auth-flow-state'),
      silent: true,
    })
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('should implement every auth flow method it advertises', () => {
    // These are optional interface members, so a missing one compiles happily
    // and silently disables persistence.
    expect(typeof adapter.saveAuthFlowState).toBe('function')
    expect(typeof adapter.consumeAuthFlowState).toBe('function')
    expect(typeof adapter.deleteExpiredAuthFlowStates).toBe('function')
  })

  it('should round-trip a state through the filesystem', async () => {
    await adapter.saveAuthFlowState(stateFor('state-1'))

    const consumed = await adapter.consumeAuthFlowState('state-1', 'oauth')

    expect(consumed?.data.codeVerifier).toBe('placeholder-verifier')
  })

  it('should hand a state to exactly one of two concurrent consumers', async () => {
    await adapter.saveAuthFlowState(stateFor('state-race'))

    const results = await Promise.all([
      adapter.consumeAuthFlowState('state-race', 'oauth'),
      adapter.consumeAuthFlowState('state-race', 'oauth'),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('should not return a state twice', async () => {
    await adapter.saveAuthFlowState(stateFor('state-2'))

    expect(await adapter.consumeAuthFlowState('state-2', 'oauth')).not.toBeNull()
    expect(await adapter.consumeAuthFlowState('state-2', 'oauth')).toBeNull()
  })

  it('should refuse a state belonging to another flow', async () => {
    await adapter.saveAuthFlowState(stateFor('state-passkey', 60_000, 'passkey'))

    expect(await adapter.consumeAuthFlowState('state-passkey', 'oauth')).toBeNull()
  })

  it('should reject an expired state', async () => {
    await adapter.saveAuthFlowState(stateFor('state-old', -1000))

    expect(await adapter.consumeAuthFlowState('state-old', 'oauth')).toBeNull()
  })

  it('should write the state with private permissions', async () => {
    // PKCE verifiers and WebAuthn challenges; the adapter's usual 0644 would
    // leave them readable by every local user.
    await adapter.saveAuthFlowState(stateFor('state-perms'))

    const fileStat = await fs.stat(path.join(dir, 'auth-flow-state', 'state-perms.json'))
    const dirStat = await fs.stat(path.join(dir, 'auth-flow-state'))

    expect(fileStat.mode & 0o077).toBe(0)
    expect(dirStat.mode & 0o077).toBe(0)
  })

  it('should sweep expired states and leave live ones', async () => {
    await adapter.saveAuthFlowState(stateFor('live', 60_000))
    await adapter.saveAuthFlowState(stateFor('stale', -1000))

    const removed = await adapter.deleteExpiredAuthFlowStates()

    expect(removed).toBe(1)
    expect(await adapter.consumeAuthFlowState('live', 'oauth')).not.toBeNull()
  })
})

describe('sweeping without a background timer', () => {
  it('sweeps on the first call and then not again until the interval has passed', async () => {
    const { sweepExpiredAuthFlowStates, resetSweepClock } = await import(
      '../../routes/auth/auth-flow-store.js'
    )
    resetSweepClock()

    let sweeps = 0
    const adapter = {
      saveAuthFlowState: async () => undefined,
      consumeAuthFlowState: async () => null,
      deleteExpiredAuthFlowStates: async () => {
        sweeps++
        return 0
      },
    } as unknown as Parameters<typeof sweepExpiredAuthFlowStates>[0]

    const start = 1_000_000
    sweepExpiredAuthFlowStates(adapter, start)
    sweepExpiredAuthFlowStates(adapter, start + 1_000)
    sweepExpiredAuthFlowStates(adapter, start + 30_000)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(sweeps).toBe(1)

    // Past the interval, the next request sweeps again.
    sweepExpiredAuthFlowStates(adapter, start + 61_000)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(sweeps).toBe(2)

    resetSweepClock()
  })

  it('never makes the caller wait, and survives a failing sweep', async () => {
    const { sweepExpiredAuthFlowStates, resetSweepClock } = await import(
      '../../routes/auth/auth-flow-store.js'
    )
    resetSweepClock()

    const adapter = {
      saveAuthFlowState: async () => undefined,
      consumeAuthFlowState: async () => null,
      deleteExpiredAuthFlowStates: async () => {
        throw new Error('storage unavailable')
      },
    } as unknown as Parameters<typeof sweepExpiredAuthFlowStates>[0]

    // Returns synchronously and does not throw: a failed sweep costs storage,
    // never a request.
    expect(() => sweepExpiredAuthFlowStates(adapter, 2_000_000)).not.toThrow()
    await new Promise(resolve => setTimeout(resolve, 10))
    resetSweepClock()
  })
})
