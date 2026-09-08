import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getCurrentUser = vi.fn()

vi.mock('@/services/api-client', () => ({
  apiClient: {
    getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
  },
}))

const { useCurrentUser } = await import('../hooks/useCurrentUser.js')
const { usePermissions } = await import('../hooks/usePermissions.js')

function Consumer({ label }: { label: string }) {
  const { user, loading } = useCurrentUser()
  return <div data-testid={label}>{loading ? 'loading' : (user?.username ?? 'none')}</div>
}

function PermissionConsumer({ label }: { label: string }) {
  const { user, loading, error, refetch } = usePermissions()
  return (
    <div data-testid={label}>
      {loading ? 'loading' : (user?.username ?? 'none')}
      {error ?? ''}
      {typeof refetch === 'function' ? ':refetchable' : ':broken'}
    </div>
  )
}

const text = (testId: string): string =>
  screen.getByTestId(testId).textContent ?? ''

function withClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('the current user is fetched once per page load', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    getCurrentUser.mockResolvedValue({
      success: true,
      data: { id: 'u1', username: 'editor', role: 'editor', permissions: [] },
    })
  })

  it('asks the server once no matter how many components need the user', async () => {
    // The Studio has fourteen of these; six is enough to show the shape.
    const labels = ['a', 'b', 'c', 'd', 'e', 'f']

    withClient(
      <>
        {labels.map(label => (
          <Consumer key={label} label={label} />
        ))}
      </>
    )

    await waitFor(() => {
      expect(text('a')).toContain('editor')
    })

    labels.forEach(label => {
      expect(text(label)).toContain('editor')
    })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('counts usePermissions consumers against the same single request', async () => {
    withClient(
      <>
        <Consumer label="direct" />
        <PermissionConsumer label="perm-1" />
        <PermissionConsumer label="perm-2" />
      </>
    )

    await waitFor(() => {
      expect(text('perm-1')).toContain('editor')
    })

    expect(getCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('keeps the return shape usePermissions callers depend on', async () => {
    withClient(<PermissionConsumer label="shape" />)

    expect(text('shape')).toContain('loading')
    expect(text('shape')).toContain(':refetchable')

    await waitFor(() => {
      expect(text('shape')).toContain('editor')
    })
  })

  it('surfaces a failed lookup as an error string, not a thrown render', async () => {
    getCurrentUser.mockResolvedValue({
      success: false,
      error: { message: 'session expired' },
    })

    withClient(<PermissionConsumer label="failed" />)

    await waitFor(() => {
      expect(text('failed')).toContain('session expired')
    })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
  })
})
