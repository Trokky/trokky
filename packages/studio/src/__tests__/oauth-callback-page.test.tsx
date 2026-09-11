/**
 * Regression tests for the OAuth callback page's terminal states (issue #13).
 *
 * Previously the page could stay in its 'processing' status forever: when the
 * stored OAuth state was missing on this origin (e.g. the callback landed on a
 * different hostname than the one that started sign-in) with no session token,
 * and when the token-exchange request never settled. Both now land in the
 * error state, which offers a way back to the login screen.
 *
 * The i18n module, the API client singleton, and the auth store are replaced
 * with mocks; `t` echoes keys so assertions target the i18n keys directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ApiResponse } from '@/types'

// Hoisted so the mock factory (which runs before any module-scope const) can
// reference it, and so tests can observe calls to the i18n module.
const i18nMocks = vi.hoisted(() => ({
  getI18n: vi.fn(() => ({ addResourceBundle: vi.fn() })),
}))

vi.mock('@trokky/trokky/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
  getI18n: i18nMocks.getI18n,
  SUPPORTED_LOCALES: ['en', 'fr'],
}))

vi.mock('@/services/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

vi.mock('@/services/auth-store', () => ({
  authStore: {
    getToken: vi.fn(),
    persist: vi.fn(),
  },
}))

// Imported after the mocks are registered.
const { OAuthCallbackPage, OAUTH_CALLBACK_TIMEOUT_MS } = await import(
  '@/pages/OAuthCallbackPage'
)
const { apiClient } = await import('@/services/api-client')
const { authStore } = await import('@/services/auth-store')

const postMock = vi.mocked(apiClient.post)
const getTokenMock = vi.mocked(authStore.getToken)

const CALLBACK_URL = '/studio/oauth/callback?code=abc&state=xyz'

function setLocation(url: string): void {
  window.history.replaceState({}, '', url)
}

async function expectErrorState(): Promise<void> {
  expect(await screen.findByText('auth.oauth.failed')).toBeTruthy()
  expect(screen.getByText('auth.oauth.notCompleted')).toBeTruthy()
  // The processing spinner copy must be gone.
  expect(screen.queryByText('auth.oauth.processing')).toBeNull()
  expect(screen.queryByText('auth.oauth.completingAuth')).toBeNull()
}

describe('OAuthCallbackPage terminal states', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    setLocation(CALLBACK_URL)
    getTokenMock.mockReturnValue(null)
  })

  it('shows the error state when the OAuth state is missing and there is no token', async () => {
    // No oauth_state in sessionStorage, no token, no API call expected.
    render(<OAuthCallbackPage onLoginSuccess={vi.fn()} />)

    // The i18n bundle is registered when the page renders, before t() is used.
    expect(i18nMocks.getI18n).toHaveBeenCalledTimes(1)

    await expectErrorState()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('shows the success state when the OAuth state is missing but a token exists', async () => {
    getTokenMock.mockReturnValue('existing-token')
    const onLoginSuccess = vi.fn()

    render(<OAuthCallbackPage onLoginSuccess={onLoginSuccess} />)

    expect(await screen.findByText('auth.oauth.success')).toBeTruthy()
    expect(screen.getByText('auth.oauth.loginSuccess')).toBeTruthy()
    expect(screen.queryByText('auth.oauth.failed')).toBeNull()
    expect(postMock).not.toHaveBeenCalled()

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1))
  })

  it('times out the token exchange and shows the error state', async () => {
    // Fake only the clocks the page's timeout uses. The default "everything"
    // mode also fakes fetch's abort-event dispatch, which would hang the
    // mocked (never-settling) request even after the controller aborts.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    sessionStorage.setItem('oauth_state', 'xyz')
    sessionStorage.setItem('oauth_code_verifier', 'verifier-123')
    sessionStorage.setItem('oauth_mode', 'login')

    // A request that never settles: nothing ever responds, but (like the real
    // client plumbing the signal into fetch) it rejects when the abort signal
    // fires. The page's own timeout must terminate it.
    postMock.mockImplementation(
      (
        _endpoint: string,
        _data?: unknown,
        options?: { signal?: AbortSignal }
      ) =>
        new Promise<ApiResponse<unknown>>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('Network error: The user aborted a request.'))
          })
        })
    )

    render(<OAuthCallbackPage onLoginSuccess={vi.fn()} />)

    // The request has started; the page is still processing.
    expect(postMock).toHaveBeenCalledTimes(1)

    // Advance past the callback timeout (plus margin). RTL's findBy* is
    // avoided while the fake clock is installed (its polling interval would
    // never fire), so afterwards restore real timers: the abort-event dispatch
    // and the React re-render then complete on the real event loop.
    await vi.advanceTimersByTimeAsync(OAUTH_CALLBACK_TIMEOUT_MS + 1_000)
    vi.useRealTimers()
    await expectErrorState()
  })

  it('navigates back to the login screen from the error state', async () => {
    // `location.href` is not writable in jsdom; redefine it for this test.
    const originalLocation = window.location
    const hrefSpy = vi.fn<(value: string) => void>()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSpy(value)
        },
        get href() {
          return originalLocation.href
        },
      },
    })

    try {
      render(<OAuthCallbackPage onLoginSuccess={vi.fn()} />)

      const button = await screen.findByRole('button', {
        name: 'auth.oauth.returnToLogin',
      })
      fireEvent.click(button)

      // setup.ts defines TROKKY_CONFIG.basePath = '/studio'.
      expect(hrefSpy).toHaveBeenCalledWith('/studio/')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('reaches the error state when storage access throws synchronously', async () => {
    const getItemSpy = vi
      .spyOn(window.sessionStorage, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Access is denied', 'SecurityError')
      })

    try {
      render(<OAuthCallbackPage onLoginSuccess={vi.fn()} />)

      await expectErrorState()
      expect(postMock).not.toHaveBeenCalled()
    } finally {
      getItemSpy.mockRestore()
    }
  })

  it('shows the error state when the token exchange fails with an API error', async () => {
    sessionStorage.setItem('oauth_state', 'xyz')
    sessionStorage.setItem('oauth_code_verifier', 'verifier-123')
    sessionStorage.setItem('oauth_mode', 'login')

    postMock.mockRejectedValue(new Error('Network error: connection refused'))

    render(<OAuthCallbackPage onLoginSuccess={vi.fn()} />)

    expect(await screen.findByText('auth.oauth.failed')).toBeTruthy()
    expect(screen.getByText('Network error: connection refused')).toBeTruthy()
    expect(screen.queryByText('auth.oauth.processing')).toBeNull()
  })

  it('does not initialize the shared i18n singleton when the module is imported', async () => {
    // Importing the page must not touch the singleton: the provider applies
    // the deployment's i18n config on mount and initI18n is init-once, so an
    // import-time getI18n() would silently discard that config for the app.
    // The other tests use the first evaluation bound at the top of this file;
    // resetModules only affects this re-import.
    vi.resetModules()
    i18nMocks.getI18n.mockClear()
    await import('@/pages/OAuthCallbackPage')
    expect(i18nMocks.getI18n).not.toHaveBeenCalled()
  })
})
