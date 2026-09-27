/**
 * Connected applications: the person sees what holds access and can take it back.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const get = vi.fn()
const del = vi.fn()
vi.mock('@/services/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a), delete: (...a: unknown[]) => del(...a) } }))
vi.mock('@trokky/trokky/i18n', () => ({
  useT: () => ({
    t: (key: string, options?: Record<string, string> | string) =>
      typeof options === 'object' && (options.name ?? options.date) ? `${key}:${options.name ?? options.date}` : key
  }),
}))

import { ConnectedApplications } from '../components/auth/ConnectedApplications'

const agent = { id: 'grant-1', clientId: 'trokky-mcp', clientName: 'Trokky MCP (AI agent)', scopes: ['content:read', 'content:write'], createdAt: '2026-09-26T10:00:00Z', lastUsedAt: '2026-09-26T11:00:00Z', userAgent: 'node', userId: 'user-2', username: 'writer' }

beforeEach(() => {
  get.mockReset()
  del.mockReset()
  vi.stubGlobal('confirm', () => true)
})

describe('ConnectedApplications', () => {
  it('lists the person\'s applications and revokes one', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [agent] } })
    del.mockResolvedValue({ success: true })
    render(<ConnectedApplications scope="mine" />)

    expect(await screen.findByText('Trokky MCP (AI agent)')).toBeTruthy()
    expect(get).toHaveBeenCalledWith('/auth/grants')
    fireEvent.click(screen.getByText('connectedApps.revoke'))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/auth/grants/grant-1'))
    await waitFor(() => expect(screen.queryByTestId('connected-app-grant-1')).toBeNull())
  })

  it('shows an admin everyone\'s, with the user, and revokes through the admin route', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [agent] } })
    del.mockResolvedValue({ success: true })
    render(<ConnectedApplications scope="all" />)

    expect(await screen.findByText(/writer/)).toBeTruthy()
    expect(get).toHaveBeenCalledWith('/admin/oauth-grants')
    fireEvent.click(screen.getByText('connectedApps.revoke'))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/admin/users/user-2/oauth-grants/grant-1'))
  })

  it('keeps an application when the person cancels', async () => {
    vi.stubGlobal('confirm', () => false)
    get.mockResolvedValue({ success: true, data: { grants: [agent] } })
    render(<ConnectedApplications scope="mine" />)
    fireEvent.click(await screen.findByText('connectedApps.revoke'))
    expect(del).not.toHaveBeenCalled()
  })

  it('says so when nothing is connected', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [] } })
    render(<ConnectedApplications scope="mine" />)
    expect(await screen.findByText('connectedApps.none')).toBeTruthy()
  })

  it('keeps the row and says so when the site refuses the revoke', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [agent] } })
    del.mockResolvedValue({ success: false })
    render(<ConnectedApplications scope="mine" />)
    fireEvent.click(await screen.findByText('connectedApps.revoke'))
    expect((await screen.findByRole('alert')).textContent).toContain('connectedApps.revokeFailed')
    expect(screen.getByTestId('connected-app-grant-1')).toBeTruthy()
  })

  it('shows the load failure and no list when the grants cannot be read', async () => {
    get.mockRejectedValue(new Error('offline'))
    render(<ConnectedApplications scope="mine" />)
    expect((await screen.findByRole('alert')).textContent).toContain('connectedApps.loadFailed')
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('connectedApps.none')).toBeNull()
  })

  it('tells an admin no application holds access', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [] } })
    render(<ConnectedApplications scope="all" />)
    expect(await screen.findByText('connectedApps.noneAll')).toBeTruthy()
    expect(screen.queryByText('connectedApps.none')).toBeNull()
  })

  it('names the application, and its user for an admin, on each Revoke button', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [agent] } })
    const { unmount } = render(<ConnectedApplications scope="mine" />)
    expect(await screen.findByRole('button', { name: 'connectedApps.revokeFor:Trokky MCP (AI agent)' })).toBeTruthy()
    unmount()
    render(<ConnectedApplications scope="all" />)
    expect(await screen.findByRole('button', { name: 'connectedApps.revokeFor:Trokky MCP (AI agent) (writer)' })).toBeTruthy()
  })

  it('sends one revoke for a double click', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [agent] } })
    del.mockReturnValue(new Promise(() => {}))
    render(<ConnectedApplications scope="mine" />)
    const button = await screen.findByText('connectedApps.revoke')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(del).toHaveBeenCalledTimes(1)
  })

  it('clears an earlier failure once a revoke succeeds, and keeps focus in the list', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [agent, { ...agent, id: 'grant-2' }] } })
    del.mockResolvedValueOnce({ success: false }).mockResolvedValue({ success: true })
    render(<ConnectedApplications scope="mine" />)
    fireEvent.click((await screen.findAllByText('connectedApps.revoke'))[0])
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getAllByText('connectedApps.revoke')[0])
    await waitFor(() => expect(screen.queryByTestId('connected-app-grant-1')).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('connected-applications'))
  })

  it('leaves out "last used" when the date is missing or unreadable', async () => {
    get.mockResolvedValue({ success: true, data: { grants: [{ ...agent, createdAt: 'garbage', lastUsedAt: undefined }] } })
    render(<ConnectedApplications scope="mine" />)
    await screen.findByText('Trokky MCP (AI agent)')
    expect(screen.queryByText(/connectedApps.lastUsed/)).toBeNull()
    expect(screen.queryByText(/Invalid Date/)).toBeNull()
    expect(screen.getByText(/connectedApps.connected:—/)).toBeTruthy()
  })
})
