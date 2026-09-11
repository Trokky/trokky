import { describe, it, expect, beforeEach } from 'vitest'
import type { AuthFlowState, DataStorageAdapter } from '../../core/types/storage-adapters.js'
import {
  saveAuthFlowState,
  getAuthFlowState,
  deleteAuthFlowState,
  clearFallbackAuthFlowStates,
} from '../../routes/auth/auth-flow-store.js'

const rows = new Map<string, AuthFlowState>()
const adapter = {
  async saveAuthFlowState(state: AuthFlowState) {
    rows.set(state.id, state)
  },
  async getAuthFlowState(id: string) {
    return rows.get(id) ?? null
  },
  async deleteAuthFlowState(id: string) {
    rows.delete(id)
  },
} as unknown as DataStorageAdapter

function stateFor(id: string, ttlMs = 60_000, kind: AuthFlowState['kind'] = 'oauth'): AuthFlowState {
  return {
    id,
    kind,
    data: { codeVerifier: 'placeholder-verifier' },
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  }
}

describe('auth flow state security properties', () => {
  beforeEach(() => {
    rows.clear()
    clearFallbackAuthFlowStates()
  })

  it('should not accept a state a second time', async () => {
    // These are CSRF protection for OAuth; a replayable state defeats the point.
    await saveAuthFlowState(adapter, stateFor('state-replay'))
    await deleteAuthFlowState(adapter, 'state-replay')

    expect(await getAuthFlowState(adapter, 'state-replay')).toBeNull()
  })

  it('should preserve the kind so one flow cannot satisfy the other', async () => {
    await saveAuthFlowState(adapter, stateFor('state-kind', 60_000, 'passkey'))

    const read = await getAuthFlowState(adapter, 'state-kind')

    expect(read?.kind).toBe('passkey')
  })

  it('should not fall back to a live in-memory copy when the stored one has expired', async () => {
    // An adapter answering "expired" must be final. Reaching past it to a
    // fallback entry would resurrect a state the source of truth rejected.
    await saveAuthFlowState({} as DataStorageAdapter, stateFor('state-shadow', 60_000))
    rows.set('state-shadow', stateFor('state-shadow', -1000))

    expect(await getAuthFlowState(adapter, 'state-shadow')).toBeNull()
  })

  it('should reject an expired fallback entry', async () => {
    await saveAuthFlowState({} as DataStorageAdapter, stateFor('state-old', -1000))

    expect(await getAuthFlowState({} as DataStorageAdapter, 'state-old')).toBeNull()
  })
})
