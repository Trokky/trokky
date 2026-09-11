import { describe, it, expect, beforeEach } from 'vitest'
import type { AuthFlowState, DataStorageAdapter } from '../../core/types/storage-adapters.js'
import {
  saveAuthFlowState,
  getAuthFlowState,
  deleteAuthFlowState,
  deleteExpiredAuthFlowStates,
  clearFallbackAuthFlowStates,
} from '../../routes/auth/auth-flow-store.js'

/**
 * Stands in for a persistent adapter. The rows object is deliberately shared
 * between instances so a test can prove one process reads what another wrote.
 */
function createPersistentAdapter(rows: Map<string, AuthFlowState>): DataStorageAdapter {
  return {
    async saveAuthFlowState(state: AuthFlowState): Promise<void> {
      rows.set(state.id, state)
    },
    async getAuthFlowState(id: string): Promise<AuthFlowState | null> {
      const found = rows.get(id)
      if (!found) return null
      return new Date(found.expiresAt).getTime() < Date.now() ? null : found
    },
    async deleteAuthFlowState(id: string): Promise<void> {
      rows.delete(id)
    },
    async deleteExpiredAuthFlowStates(): Promise<number> {
      let removed = 0
      for (const [id, state] of rows.entries()) {
        if (new Date(state.expiresAt).getTime() < Date.now()) {
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

function stateFor(id: string, ttlMs = 60_000): AuthFlowState {
  return {
    id,
    kind: 'oauth',
    data: { codeVerifier: 'placeholder-verifier', mode: 'login' },
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  }
}

describe('auth flow store', () => {
  beforeEach(() => {
    clearFallbackAuthFlowStates()
  })

  it('should let a second instance read state written by the first', async () => {
    // The whole point of persisting: initiate and callback are separate
    // requests and may not be served by the same process.
    const sharedRows = new Map<string, AuthFlowState>()
    const instanceA = createPersistentAdapter(sharedRows)
    const instanceB = createPersistentAdapter(sharedRows)

    await saveAuthFlowState(instanceA, stateFor('state-1'))
    clearFallbackAuthFlowStates() // instance B has no in-process memory of it

    const read = await getAuthFlowState(instanceB, 'state-1')

    expect(read).not.toBeNull()
    expect(read?.data.codeVerifier).toBe('placeholder-verifier')
  })

  it('should reject an expired state', async () => {
    const adapter = createPersistentAdapter(new Map())
    await saveAuthFlowState(adapter, stateFor('state-expired', -1000))

    expect(await getAuthFlowState(adapter, 'state-expired')).toBeNull()
  })

  it('should treat a consumed state as unknown', async () => {
    const adapter = createPersistentAdapter(new Map())
    await saveAuthFlowState(adapter, stateFor('state-2'))

    await deleteAuthFlowState(adapter, 'state-2')

    expect(await getAuthFlowState(adapter, 'state-2')).toBeNull()
  })

  it('should not throw when deleting a state that is already gone', async () => {
    const adapter = createPersistentAdapter(new Map())

    await expect(deleteAuthFlowState(adapter, 'never-existed')).resolves.toBeUndefined()
  })

  it('should fall back to memory for an adapter without the methods', async () => {
    // An adapter that predates this interface must keep working exactly as
    // before rather than failing every sign-in.
    await saveAuthFlowState(legacyAdapter, stateFor('state-3'))

    const read = await getAuthFlowState(legacyAdapter, 'state-3')

    expect(read?.id).toBe('state-3')
  })

  it('should expire fallback entries too', async () => {
    await saveAuthFlowState(legacyAdapter, stateFor('state-4', -1000))

    expect(await getAuthFlowState(legacyAdapter, 'state-4')).toBeNull()
  })

  it('should keep the sign-in working when the adapter write fails', async () => {
    // A storage blip should not be the reason someone cannot log in.
    const failing = {
      saveAuthFlowState: async () => {
        throw new Error('storage unavailable')
      },
      getAuthFlowState: async () => null,
      deleteAuthFlowState: async () => {},
    } as unknown as DataStorageAdapter

    await saveAuthFlowState(failing, stateFor('state-5'))

    expect((await getAuthFlowState(failing, 'state-5'))?.id).toBe('state-5')
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
    expect(await getAuthFlowState(legacyAdapter, 'stale-memory')).toBeNull()
  })
})
