import { describe, it, expect, beforeEach } from 'vitest'
import type { AuthFlowState, DataStorageAdapter } from '../../core/types/storage-adapters.js'
import {
  saveAuthFlowState,
  consumeAuthFlowState,
  deleteExpiredAuthFlowStates,
  clearFallbackAuthFlowStates,
} from '../../routes/auth/auth-flow-store.js'

/**
 * Stands in for a persistent adapter, consuming atomically the way Postgres
 * does with DELETE ... RETURNING. The rows map is shared between instances so a
 * test can prove one process reads what another wrote.
 */
function createPersistentAdapter(rows: Map<string, AuthFlowState>): DataStorageAdapter {
  return {
    async saveAuthFlowState(state: AuthFlowState): Promise<void> {
      rows.set(state.id, state)
    },
    async consumeAuthFlowState(id: string, kind: AuthFlowState['kind']): Promise<AuthFlowState | null> {
      const found = rows.get(id)
      if (!found || found.kind !== kind) return null
      if (new Date(found.expiresAt).getTime() <= Date.now()) return null
      rows.delete(id)
      return found
    },
    async deleteExpiredAuthFlowStates(): Promise<number> {
      let removed = 0
      for (const [id, state] of rows.entries()) {
        if (new Date(state.expiresAt).getTime() <= Date.now()) {
          rows.delete(id)
          removed++
        }
      }
      return removed
    },
  } as unknown as DataStorageAdapter
}

/** An adapter from before these methods existed. */
const legacyAdapter = {} as DataStorageAdapter

function stateFor(
  id: string,
  ttlMs = 60_000,
  kind: AuthFlowState['kind'] = 'oauth'
): AuthFlowState {
  return {
    id,
    kind,
    data: { codeVerifier: 'placeholder-verifier', mode: 'login' },
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  }
}

describe('auth flow store', () => {
  beforeEach(() => {
    clearFallbackAuthFlowStates()
  })

  it('should let a second instance consume state written by the first', async () => {
    // The point of persisting: initiate and callback are separate requests and
    // may not be served by the same process.
    const sharedRows = new Map<string, AuthFlowState>()
    const instanceA = createPersistentAdapter(sharedRows)
    const instanceB = createPersistentAdapter(sharedRows)

    await saveAuthFlowState(instanceA, stateFor('state-1'))
    clearFallbackAuthFlowStates() // instance B has no in-process memory of it

    const consumed = await consumeAuthFlowState(instanceB, 'state-1', 'oauth')

    expect(consumed?.data.codeVerifier).toBe('placeholder-verifier')
  })

  it('should hand the state to exactly one of two concurrent callers', async () => {
    // Single use is the security property: an OAuth state is CSRF protection
    // and a WebAuthn challenge must not be answerable twice. A read followed by
    // a separate delete would let both callers through.
    const adapter = createPersistentAdapter(new Map())
    await saveAuthFlowState(adapter, stateFor('state-race'))

    const [first, second] = await Promise.all([
      consumeAuthFlowState(adapter, 'state-race', 'oauth'),
      consumeAuthFlowState(adapter, 'state-race', 'oauth'),
    ])

    expect([first, second].filter(Boolean)).toHaveLength(1)
  })

  it('should not return a state twice', async () => {
    const adapter = createPersistentAdapter(new Map())
    await saveAuthFlowState(adapter, stateFor('state-2'))

    expect(await consumeAuthFlowState(adapter, 'state-2', 'oauth')).not.toBeNull()
    expect(await consumeAuthFlowState(adapter, 'state-2', 'oauth')).toBeNull()
  })

  it('should refuse a state belonging to another flow, and leave it intact', async () => {
    // A passkey session id presented to the OAuth callback must neither be
    // accepted nor destroyed - otherwise it is a way to cancel someone's
    // sign-in by guessing an id.
    const adapter = createPersistentAdapter(new Map())
    await saveAuthFlowState(adapter, stateFor('state-passkey', 60_000, 'passkey'))

    expect(await consumeAuthFlowState(adapter, 'state-passkey', 'oauth')).toBeNull()
    expect(await consumeAuthFlowState(adapter, 'state-passkey', 'passkey')).not.toBeNull()
  })

  it('should reject an expired state, including exactly at its expiry', async () => {
    const adapter = createPersistentAdapter(new Map())
    await saveAuthFlowState(adapter, stateFor('state-expired', -1000))
    await saveAuthFlowState(adapter, stateFor('state-boundary', 0))

    expect(await consumeAuthFlowState(adapter, 'state-expired', 'oauth')).toBeNull()
    expect(await consumeAuthFlowState(adapter, 'state-boundary', 'oauth')).toBeNull()
  })

  it('should treat an unparseable expiry as expired rather than eternal', async () => {
    // NaN < Date.now() is false, so a naive comparison would accept a corrupt
    // record for ever.
    await saveAuthFlowState(legacyAdapter, { ...stateFor('state-nan'), expiresAt: 'not-a-date' })

    expect(await consumeAuthFlowState(legacyAdapter, 'state-nan', 'oauth')).toBeNull()
  })

  it('should raise when a capable adapter cannot persist, rather than pretending', async () => {
    // Silently keeping it in memory would report a durability the caller does
    // not have, and would reintroduce exactly the bug this store exists to fix.
    const failing = {
      saveAuthFlowState: async () => {
        throw new Error('storage unavailable')
      },
      consumeAuthFlowState: async () => null,
    } as unknown as DataStorageAdapter

    await expect(saveAuthFlowState(failing, stateFor('state-5'))).rejects.toThrow(
      'storage unavailable'
    )
  })

  it('should fall back to memory for an adapter without the methods', async () => {
    // An adapter predating this interface must keep working rather than
    // failing every sign-in.
    await saveAuthFlowState(legacyAdapter, stateFor('state-3'))

    expect((await consumeAuthFlowState(legacyAdapter, 'state-3', 'oauth'))?.id).toBe('state-3')
  })

  it('should sweep expired states from both the adapter and memory', async () => {
    const rows = new Map<string, AuthFlowState>()
    const adapter = createPersistentAdapter(rows)

    await saveAuthFlowState(adapter, stateFor('live', 60_000))
    rows.set('stale', stateFor('stale', -1000))
    await saveAuthFlowState(legacyAdapter, stateFor('stale-memory', -1000))

    await deleteExpiredAuthFlowStates(adapter)

    expect(rows.has('stale')).toBe(false)
    expect(rows.has('live')).toBe(true)
    expect(await consumeAuthFlowState(legacyAdapter, 'stale-memory', 'oauth')).toBeNull()
  })
})
