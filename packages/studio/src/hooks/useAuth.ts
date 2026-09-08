import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useRef,
  useCallback,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api-client'
import { authStore } from '@/services/auth-store'
import { createStudioLogger } from '@/utils/logger'
import type { User } from '@/types'
import { clearStructureCache } from '../services/structure-service.js'

const logger = createStudioLogger('useAuth')

// Get session configuration from runtime config or use defaults
const getSessionConfig = () => {
  const runtimeConfig = (window as any).TROKKY_CONFIG
  const sessionConfig = runtimeConfig?.sessionConfig

  return {
    // Auto-refresh token 30 seconds before expiry
    REFRESH_BUFFER_MS: sessionConfig?.refreshBufferMs || 30 * 1000,
    // Disable session warning - let auto-refresh handle expiry silently
    WARNING_BUFFER_MS: sessionConfig?.warningBufferMs || 0,
    // Check session every 30 seconds (less aggressive)
    CHECK_INTERVAL_MS: sessionConfig?.checkIntervalMs || 30 * 1000,
    // Session timeout for content management (2 hours)
    DEFAULT_TIMEOUT_MS: sessionConfig?.defaultTimeoutMs || 2 * 60 * 60 * 1000,
    // Extended session for "Remember Me" (7 days)
    EXTENDED_TIMEOUT_MS:
      sessionConfig?.extendedTimeoutMs || 7 * 24 * 60 * 60 * 1000,
    // Inactivity timeout (30 minutes)
    INACTIVITY_TIMEOUT_MS: sessionConfig?.inactivityTimeoutMs || 30 * 60 * 1000,
  }
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  sessionExpiresAt: Date | null
  showTimeoutWarning: boolean
  lastActivity: Date
}

interface AuthContextType extends AuthState {
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  refreshSession: () => Promise<void>
  dismissTimeoutWarning: () => void
  updateActivity: () => void
  updateUser: (user: any) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const signedOutState = (): AuthState => ({
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  sessionExpiresAt: null,
  showTimeoutWarning: false,
  lastActivity: new Date(),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    ...signedOutState(),
    isLoading: true,
  })

  const queryClient = useQueryClient()
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null)
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null)
  const authStateRef = useRef<AuthState>(authState)

  // Keep the ref in sync so the interval callbacks can read the latest state
  // without being torn down and rebuilt on every render.
  useEffect(() => {
    authStateRef.current = authState
  }, [authState])

  const stopSessionMonitoring = useCallback(() => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current)
      sessionCheckRef.current = null
    }
    if (inactivityCheckRef.current) {
      clearInterval(inactivityCheckRef.current)
      inactivityCheckRef.current = null
    }
  }, [])

  const endSession = useCallback(() => {
    stopSessionMonitoring()
    authStore.clear()
    // Every cached read - the current user above all - belonged to the session
    // that just ended; the next sign-in must not see the previous user's data.
    queryClient.clear()
    // The structure service keeps its own copy outside react-query, and
    // /config/structure is generated per user: without this the next sign-in
    // would render the previous user's navigation and schema availability.
    clearStructureCache()
    setAuthState(signedOutState())
  }, [queryClient, stopSessionMonitoring])

  // Track user activity for inactivity detection
  const updateActivity = useCallback(() => {
    setAuthState(prev => ({ ...prev, lastActivity: new Date() }))
  }, [])

  /**
   * The only refresh path in the Studio. The store de-duplicates concurrent
   * calls, so the session timer and a 401 arriving at the same moment share one
   * `/auth/refresh` round trip.
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const session = await authStore.refresh()

    if (!session) {
      logger.warn('Session refresh failed, ending session')
      endSession()
      return false
    }

    setAuthState(prev => ({
      ...prev,
      token: session.token,
      refreshToken: authStore.getRefreshToken(),
      sessionExpiresAt: session.expiresAt
        ? new Date(session.expiresAt)
        : prev.sessionExpiresAt,
      showTimeoutWarning: false,
    }))

    logger.info('Session refreshed successfully')
    return true
  }, [endSession])

  // Session monitoring: expiry-driven refresh plus an inactivity watchdog.
  const startSessionMonitoring = useCallback(
    (expiresAt: Date | null) => {
      if (!expiresAt) return

      stopSessionMonitoring()

      const sessionConfig = getSessionConfig()

      sessionCheckRef.current = setInterval(() => {
        const timeUntilExpiry = expiresAt.getTime() - Date.now()

        if (
          timeUntilExpiry <= sessionConfig.REFRESH_BUFFER_MS &&
          timeUntilExpiry > 0
        ) {
          refreshSession()
        }

        if (timeUntilExpiry <= 0) {
          logger.warn('Session expired, forcing logout')
          endSession()
        }
      }, sessionConfig.CHECK_INTERVAL_MS)

      inactivityCheckRef.current = setInterval(() => {
        const timeSinceActivity =
          Date.now() - authStateRef.current.lastActivity.getTime()

        if (timeSinceActivity >= sessionConfig.INACTIVITY_TIMEOUT_MS) {
          logger.warn('User inactive for too long, forcing logout')
          endSession()
        }
      }, sessionConfig.CHECK_INTERVAL_MS)
    },
    [endSession, refreshSession, stopSessionMonitoring]
  )

  const checkAuth = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const { token: storedToken, refreshToken: storedRefreshToken } =
        authStore.getTokens()

      logger.info('Checking auth', {
        hasStoredToken: !!storedToken,
        hasRefreshToken: !!storedRefreshToken,
      })

      if (!storedToken) {
        logger.info('No stored token, showing login page')
        setAuthState(signedOutState())
        return
      }

      const response = await apiClient.post('/auth/validate', {
        token: storedToken,
      })

      if (
        response.success &&
        response.data &&
        typeof response.data === 'object' &&
        'valid' in response.data &&
        response.data.valid &&
        'session' in response.data &&
        response.data.session
      ) {
        logger.info('Authentication validated successfully')

        const sessionData = response.data.session as any
        const expiresAt = sessionData.expiresAt
          ? new Date(sessionData.expiresAt)
          : null

        setAuthState({
          isAuthenticated: true,
          user: sessionData?.user || sessionData,
          token: storedToken,
          refreshToken: storedRefreshToken,
          isLoading: false,
          sessionExpiresAt: expiresAt,
          showTimeoutWarning: false,
          lastActivity: new Date(),
        })

        startSessionMonitoring(expiresAt)
        return
      }

      // Stored token is stale: fall through to the one refresh mechanism.
      const session = await authStore.refresh()
      if (session?.token) {
        const sessionExpiresAt = session.expiresAt
          ? new Date(session.expiresAt)
          : null

        setAuthState({
          isAuthenticated: true,
          user: (session.user as User) ?? null,
          token: session.token,
          refreshToken: authStore.getRefreshToken(),
          isLoading: false,
          sessionExpiresAt,
          showTimeoutWarning: false,
          lastActivity: new Date(),
        })

        startSessionMonitoring(sessionExpiresAt)
        logger.info('Session restored via refresh token')
        return
      }

      logger.warn('Stored tokens are invalid, clearing auth state')
      endSession()
    } catch (error) {
      logger.error('Auth check failed', error)
      endSession()
    }
  }, [endSession, startSessionMonitoring])

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await apiClient.post('/auth/login', {
          username,
          password,
          rememberMe,
        })

        if (
          response.success &&
          response.data &&
          typeof response.data === 'object' &&
          'user' in response.data &&
          'token' in response.data &&
          'expiresAt' in response.data
        ) {
          const { user, token, refreshToken, expiresAt } = response.data as {
            user: any
            token: string
            refreshToken?: string
            expiresAt: string
          }

          logger.info('User login successful', { username, rememberMe })

          authStore.persist(token, refreshToken)

          const sessionExpiresAt = new Date(expiresAt)

          setAuthState({
            isAuthenticated: true,
            user,
            token,
            refreshToken: refreshToken || null,
            isLoading: false,
            sessionExpiresAt,
            showTimeoutWarning: false,
            lastActivity: new Date(),
          })

          startSessionMonitoring(sessionExpiresAt)

          return { success: true }
        }

        logger.warn('Login failed', {
          username,
          error: response.error?.message,
        })
        return {
          success: false,
          error: response.error?.message || 'Login failed',
        }
      } catch (error) {
        logger.error('Login error', { username, error })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Login failed',
        }
      }
    },
    [startSessionMonitoring]
  )

  const logout = useCallback(async () => {
    try {
      stopSessionMonitoring()

      const refreshToken = authStore.getRefreshToken()
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken })
      }
      logger.info('User logout successful')
    } catch (error) {
      logger.error('Logout failed', error)
    } finally {
      endSession()
    }
  }, [endSession, stopSessionMonitoring])

  const dismissTimeoutWarning = useCallback(() => {
    setAuthState(prev => ({ ...prev, showTimeoutWarning: false }))
  }, [])

  const updateUser = useCallback((user: any) => {
    setAuthState(prev => ({ ...prev, user }))
  }, [])

  // A 401 hands recovery to the one refresh mechanism. The API client retries
  // the failed request at most once on a true result.
  useEffect(() => {
    apiClient.onUnauthorized = async () => refreshSession()
    return () => {
      apiClient.onUnauthorized = null
    }
  }, [refreshSession])

  // Set up activity tracking
  useEffect(() => {
    if (!authState.isAuthenticated) return

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ]

    const handleActivity = () => updateActivity()

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [authState.isAuthenticated, updateActivity])

  // Check auth on mount
  useEffect(() => {
    checkAuth()

    return () => {
      stopSessionMonitoring()
    }
    // Deliberately mount-only: checkAuth is stable and re-running it would
    // re-validate the session on every render of the provider.
  }, [])

  // Restart session monitoring when the expiry moves (after a refresh)
  useEffect(() => {
    if (authState.isAuthenticated && authState.sessionExpiresAt) {
      startSessionMonitoring(authState.sessionExpiresAt)
    }
  }, [
    authState.sessionExpiresAt,
    authState.isAuthenticated,
    startSessionMonitoring,
  ])

  const contextValue = {
    ...authState,
    login,
    logout,
    checkAuth,
    refreshSession,
    dismissTimeoutWarning,
    updateActivity,
    updateUser,
  } as unknown as AuthContextType

  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    children
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
