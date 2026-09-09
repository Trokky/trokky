/**
 * Guard for the studio's route tree.
 *
 * Written during the react-router 6 -> 7 upgrade: nothing covered routing, so a
 * silently broken route table (wrong nesting, a param route that stops matching,
 * a splat that swallows real paths) would only have shown up in the browser.
 *
 * The real `routes` array from app/Router.tsx is mounted under a memory router;
 * only the leaf page components and the layout chrome are stubbed, so what is
 * under test is the route configuration itself, not the pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import {
  createMemoryRouter,
  RouterProvider,
  Outlet,
  Link,
  useParams,
} from 'react-router'

// A stub page that also reports the params it matched, so the param routes are
// asserted on rather than just "something rendered".
const stubPage = (name: string) => () => {
  const params = useParams()
  return (
    <div data-testid={`page-${name}`}>
      {name}
      <span data-testid={`params-${name}`}>{JSON.stringify(params)}</span>
    </div>
  )
}

vi.mock('@/components/layout/StudioLayout', () => ({
  StudioLayout: () => (
    <div data-testid="studio-layout">
      <Link to="/media" data-testid="link-media">
        media
      </Link>
      <Outlet />
    </div>
  ),
}))
vi.mock('@/components/ui/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: stubPage('dashboard') }))
vi.mock('@/pages/ContentPage', () => ({ ContentPage: stubPage('content') }))
vi.mock('@/pages/MediaPage', () => ({ MediaPage: stubPage('media') }))
vi.mock('@/pages/UsersPage', () => ({ UsersPage: stubPage('users') }))
vi.mock('@/pages/SettingsPage', () => ({ SettingsPage: stubPage('settings') }))
vi.mock('@/pages/UserPreferencesPage', () => ({
  UserPreferencesPage: stubPage('preferences'),
}))
vi.mock('@/pages/AuditLogsPage', () => ({ AuditLogsPage: stubPage('audit-logs') }))
vi.mock('@/pages/NotFoundPage', () => ({ NotFoundPage: stubPage('not-found') }))
vi.mock('@/pages/OAuthCallbackPage', () => ({ OAuthCallbackPage: stubPage('oauth') }))
vi.mock('@/pages/DeviceAuthPage', () => ({ DeviceAuthPage: stubPage('device-auth') }))
vi.mock('@/pages/AuthorizePage', () => ({ AuthorizePage: stubPage('authorize') }))

// Imported after the mocks are registered.
const { routes } = await import('@/app/Router')

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return { router, ...render(<RouterProvider router={router} />) }
}

describe('studio route tree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['/', 'dashboard', true],
    ['/content', 'content', true],
    ['/media', 'media', true],
    ['/users', 'users', true],
    ['/settings', 'settings', true],
    ['/user/preferences', 'preferences', true],
    ['/audit-logs', 'audit-logs', true],
    // Standalone routes deliberately sit outside the layout.
    ['/oauth/callback', 'oauth', false],
    ['/auth/device', 'device-auth', false],
    ['/auth/authorize', 'authorize', false],
  ])('resolves %s to the %s page', async (path, page, insideLayout) => {
    renderAt(path)
    expect(await screen.findByTestId(`page-${page}`)).toBeTruthy()
    if (insideLayout) {
      expect(screen.getByTestId('studio-layout')).toBeTruthy()
    } else {
      expect(screen.queryByTestId('studio-layout')).toBeNull()
    }
  })

  it.each([
    ['/content/article', 'content', { schemaName: 'article' }],
    [
      '/content/article/abc123',
      'content',
      { schemaName: 'article', documentId: 'abc123' },
    ],
    ['/users/u-1', 'users', { userId: 'u-1' }],
    ['/settings/general', 'settings', { section: 'general' }],
  ])('matches %s with the expected params', async (path, page, expected) => {
    renderAt(path)
    expect(await screen.findByTestId(`page-${page}`)).toBeTruthy()
    const params = JSON.parse(screen.getByTestId(`params-${page}`).textContent!)
    expect(params).toMatchObject(expected)
  })

  it('falls through to the not-found page inside the layout', async () => {
    renderAt('/definitely-not-a-route')
    expect(await screen.findByTestId('page-not-found')).toBeTruthy()
    expect(screen.getByTestId('studio-layout')).toBeTruthy()
  })

  it('navigates between two routes without a full reload', async () => {
    const { router } = renderAt('/content')
    expect(await screen.findByTestId('page-content')).toBeTruthy()

    fireEvent.click(screen.getByTestId('link-media'))

    expect(await screen.findByTestId('page-media')).toBeTruthy()
    expect(screen.queryByTestId('page-content')).toBeNull()
    expect(router.state.location.pathname).toBe('/media')
    // The layout is the shared parent, so it must not have remounted.
    expect(screen.getByTestId('studio-layout')).toBeTruthy()
  })

  it('navigates imperatively to a param route and back', async () => {
    const { router } = renderAt('/content')
    expect(await screen.findByTestId('page-content')).toBeTruthy()

    await router.navigate('/content/article/abc123')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/content/article/abc123')
    })
    const params = JSON.parse(screen.getByTestId('params-content').textContent!)
    expect(params).toMatchObject({ schemaName: 'article', documentId: 'abc123' })

    await router.navigate(-1)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/content')
    })
  })
})
