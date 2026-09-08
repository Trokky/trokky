/**
 * Auth store - the single owner of session token persistence.
 *
 * Nothing else in the Studio touches the auth/refresh token keys in
 * localStorage: the API client, the AuthProvider, the login and OAuth pages all
 * read and write through this module. It also owns the one refresh mechanism,
 * de-duplicated so concurrent 401s and the session timer share a single
 * `/auth/refresh` round trip.
 */

export const AUTH_TOKEN_KEY = 'trokky_auth_token'
export const REFRESH_TOKEN_KEY = 'trokky_refresh_token'

export interface AuthTokens {
  token: string | null
  refreshToken: string | null
}

/** Shape the server returns from `/auth/refresh`. */
export interface RefreshedSession {
  token: string
  refreshToken?: string
  expiresAt?: string
  user?: unknown
}

/**
 * Performs the refresh round trip. Injected so this module stays free of any
 * dependency on the API client (which depends on the store).
 */
export type Refresher = (
  refreshToken: string
) => Promise<RefreshedSession | null>

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode / storage disabled: the in-memory token still works for
    // this tab, it just will not survive a reload.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to do - the in-memory copy is cleared regardless.
  }
}

export class AuthStore {
  private tokens: AuthTokens
  private listeners = new Set<(tokens: AuthTokens) => void>()
  private refresher: Refresher | null = null
  private inFlight: Promise<RefreshedSession | null> | null = null
  /** Bumped whenever the session ends, so late async work can be discarded. */
  private session = 0

  constructor() {
    this.tokens = {
      token: readStorage(AUTH_TOKEN_KEY),
      refreshToken: readStorage(REFRESH_TOKEN_KEY),
    }
  }

  getTokens(): AuthTokens {
    return { ...this.tokens }
  }

  getToken(): string | null {
    return this.tokens.token
  }

  getRefreshToken(): string | null {
    return this.tokens.refreshToken
  }

  /**
   * Persist a session. Omitting `refreshToken` leaves the stored one alone, so
   * endpoints that only hand back a new access token cannot silently drop it.
   */
  persist(token: string, refreshToken?: string | null): void {
    this.tokens.token = token
    writeStorage(AUTH_TOKEN_KEY, token)

    if (refreshToken) {
      this.tokens.refreshToken = refreshToken
      writeStorage(REFRESH_TOKEN_KEY, refreshToken)
    }

    this.emit()
  }

  clear(): void {
    // Invalidate any refresh already in flight: its response belongs to the
    // session being ended, and persisting it would resurrect the login.
    this.session += 1
    this.inFlight = null
    this.tokens = { token: null, refreshToken: null }
    removeStorage(AUTH_TOKEN_KEY)
    removeStorage(REFRESH_TOKEN_KEY)
    this.emit()
  }

  private emit(): void {
    const snapshot = this.getTokens()
    this.listeners.forEach(listener => listener(snapshot))
  }

  subscribe(listener: (tokens: AuthTokens) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setRefresher(refresher: Refresher | null): void {
    this.refresher = refresher
  }

  /**
   * The one refresh path. Concurrent callers join the in-flight request rather
   * than each firing their own; a failure clears the session exactly once.
   */
  async refresh(): Promise<RefreshedSession | null> {
    if (this.inFlight) {
      return this.inFlight
    }

    const refreshToken = this.tokens.refreshToken
    if (!refreshToken || !this.refresher) {
      return null
    }

    // Remember which session this refresh belongs to. A logout (or another
    // login) bumps the counter, and a late response must then change nothing.
    const session = this.session

    this.inFlight = (async () => {
      try {
        const refreshed = await this.refresher!(refreshToken)
        if (session !== this.session) return null
        if (refreshed?.token) {
          this.persist(refreshed.token, refreshed.refreshToken)
          return refreshed
        }
        this.clear()
        return null
      } catch {
        if (session !== this.session) return null
        this.clear()
        return null
      } finally {
        if (session === this.session) this.inFlight = null
      }
    })()

    return this.inFlight
  }
}

export const authStore = new AuthStore()
