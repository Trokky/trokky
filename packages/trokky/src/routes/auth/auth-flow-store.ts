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
 * an adapter written against the older interface keeps working.
 */

import type { DataStorageAdapter, AuthFlowState } from '../../core/types/storage-adapters.js'
import { createLogger } from '../../core/utils/logger.js'

const logger = createLogger('routes', 'AuthFlowStore')

/** Entries live here only when the adapter cannot store them. */
const fallbackStore = new Map<string, AuthFlowState>()

type PersistentAdapter = DataStorageAdapter &
  Required<Pick<DataStorageAdapter, 'saveAuthFlowState' | 'consumeAuthFlowState'>>

function adapterSupportsPersistence(
  adapter: DataStorageAdapter | null | undefined
): adapter is PersistentAdapter {
  return Boolean(adapter?.saveAuthFlowState && adapter.consumeAuthFlowState)
}

/**
 * An unparseable expiry is treated as expired rather than as "never expires":
 * `NaN < Date.now()` is false, so a naive comparison would accept a corrupt
 * record forever. The boundary is exclusive - a state is dead at its expiry
 * instant, not one millisecond after.
 */
function isUsable(state: AuthFlowState): boolean {
  const expiresAt = new Date(state.expiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

/**
 * Store a pending flow.
 *
 * A failure to persist is raised, not swallowed. Keeping the entry in memory
 * would report a durability the caller does not have and silently reintroduce
 * the bug this store exists to fix: the sign-in would appear to start and then
 * fail at the callback if it landed on another process. Failing here costs one
 * retry and is honest about what happened.
 */
export async function saveAuthFlowState(
  adapter: DataStorageAdapter | null | undefined,
  state: AuthFlowState
): Promise<void> {
  if (adapterSupportsPersistence(adapter)) {
    await adapter.saveAuthFlowState(state)
    return
  }
  fallbackStore.set(state.id, state)
}

/**
 * Take a pending flow: return it and consume it, or return null.
 *
 * Single use is the security property here - an OAuth state is CSRF protection
 * and a WebAuthn challenge must not be answerable twice - so the adapter is
 * asked to return and delete in one atomic operation rather than being read and
 * then deleted, which would let two concurrent callbacks both succeed.
 *
 * A storage failure propagates: a caller that cannot prove it consumed the
 * state must not continue as though it had.
 */
export async function consumeAuthFlowState(
  adapter: DataStorageAdapter | null | undefined,
  id: string,
  kind: AuthFlowState['kind']
): Promise<AuthFlowState | null> {
  if (adapterSupportsPersistence(adapter)) {
    const consumed = await adapter.consumeAuthFlowState(id, kind)
    return consumed && isUsable(consumed) ? consumed : null
  }

  // The fallback map is only reachable on a single process, and there is no
  // await between the read and the delete, so this is atomic by the same
  // argument that made the original in-process map safe.
  const fallback = fallbackStore.get(id)
  fallbackStore.delete(id)
  if (!fallback || fallback.kind !== kind || !isUsable(fallback)) return null
  return fallback
}

/**
 * Drop everything that has expired.
 *
 * Sweeping is best-effort: expired entries are rejected on read regardless, so
 * a failed sweep costs storage rather than correctness.
 */
export async function deleteExpiredAuthFlowStates(
  adapter: DataStorageAdapter | null | undefined
): Promise<void> {
  for (const [id, state] of fallbackStore.entries()) {
    if (!isUsable(state)) fallbackStore.delete(id)
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
