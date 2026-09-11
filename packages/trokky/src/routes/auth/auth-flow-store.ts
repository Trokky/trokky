/**
 * Storage for a sign-in that spans two requests.
 *
 * OAuth login state with its PKCE verifier, and the WebAuthn challenge behind a
 * passkey, are both written when a flow begins and read once when it completes.
 * Held in the server process, a restart between the two halves fails the
 * sign-in and a second replica cannot serve the second half at all.
 *
 * Persists through the data storage adapter when it implements the optional
 * auth flow methods, and falls back to an in-process map when it does not, so
 * an adapter that has not been updated keeps working exactly as before.
 */

import type { DataStorageAdapter, AuthFlowState } from '../../core/types/storage-adapters.js'
import { createLogger } from '../../core/utils/logger.js'

const logger = createLogger('routes', 'AuthFlowStore')

/** Entries live here only when the adapter cannot store them. */
const fallbackStore = new Map<string, AuthFlowState>()

function adapterSupportsPersistence(
  adapter: DataStorageAdapter | null | undefined
): adapter is DataStorageAdapter &
  Required<Pick<DataStorageAdapter, 'saveAuthFlowState' | 'getAuthFlowState' | 'deleteAuthFlowState'>> {
  return Boolean(adapter?.saveAuthFlowState && adapter.getAuthFlowState && adapter.deleteAuthFlowState)
}

function isExpired(state: AuthFlowState): boolean {
  return new Date(state.expiresAt).getTime() < Date.now()
}

/**
 * Store a pending flow.
 *
 * A storage failure is not fatal: the entry goes to the fallback map so the
 * sign-in in progress still completes on this process, and the failure is
 * logged rather than surfaced to someone trying to log in.
 */
export async function saveAuthFlowState(
  adapter: DataStorageAdapter | null | undefined,
  state: AuthFlowState
): Promise<void> {
  if (adapterSupportsPersistence(adapter)) {
    try {
      await adapter.saveAuthFlowState(state)
      return
    } catch (error) {
      logger.error('Failed to persist auth flow state, falling back to memory', { error, kind: state.kind })
    }
  }
  fallbackStore.set(state.id, state)
}

/**
 * Read a pending flow, or null when it is unknown or expired.
 *
 * The fallback map is consulted even when the adapter is available, so a flow
 * that began before the adapter recovered is still completable.
 */
export async function getAuthFlowState(
  adapter: DataStorageAdapter | null | undefined,
  id: string
): Promise<AuthFlowState | null> {
  if (adapterSupportsPersistence(adapter)) {
    try {
      const stored = await adapter.getAuthFlowState(id)
      if (stored && !isExpired(stored)) return stored
      if (stored) return null
    } catch (error) {
      logger.error('Failed to read auth flow state, falling back to memory', { error })
    }
  }

  const fallback = fallbackStore.get(id)
  if (!fallback) return null
  if (isExpired(fallback)) {
    fallbackStore.delete(id)
    return null
  }
  return fallback
}

/** Remove a consumed flow. Deleting an unknown id is not an error. */
export async function deleteAuthFlowState(
  adapter: DataStorageAdapter | null | undefined,
  id: string
): Promise<void> {
  fallbackStore.delete(id)
  if (adapterSupportsPersistence(adapter)) {
    try {
      await adapter.deleteAuthFlowState(id)
    } catch (error) {
      logger.error('Failed to delete auth flow state', { error })
    }
  }
}

/**
 * Drop everything that has expired.
 *
 * Called on a timer by the routes that own a flow. Sweeping is best-effort:
 * expired entries are rejected on read regardless, so a failed sweep costs
 * storage rather than correctness.
 */
export async function deleteExpiredAuthFlowStates(
  adapter: DataStorageAdapter | null | undefined
): Promise<void> {
  for (const [id, state] of fallbackStore.entries()) {
    if (isExpired(state)) fallbackStore.delete(id)
  }

  if (adapter?.deleteExpiredAuthFlowStates) {
    try {
      await adapter.deleteExpiredAuthFlowStates()
    } catch (error) {
      logger.error('Failed to sweep expired auth flow states', { error })
    }
  }
}

/** Test seam: drops the in-process entries without touching the adapter. */
export function clearFallbackAuthFlowStates(): void {
  fallbackStore.clear()
}
