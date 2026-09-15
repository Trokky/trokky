/**
 * The claim page is the first thing a newcomer sees on a fresh deployment, and it creates the
 * account that owns the instance. What is pinned here: it sends exactly what the API expects,
 * it only asks for a secret when the deployment has one, a successful claim signs in through the
 * same path as a login, and a claim that succeeded without a session does not strand the user.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@trokky/trokky/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/api-client', () => ({
  apiClient: { claimInstance: vi.fn() },
}))

vi.mock('@/services/auth-store', () => ({
  authStore: { persist: vi.fn() },
}))

import { apiClient } from '@/services/api-client'
import { authStore } from '@/services/auth-store'
import { ClaimPage } from '../pages/ClaimPage'

const claimMock = vi.mocked(apiClient.claimInstance)
const persistMock = vi.mocked(authStore.persist)

function fill(name: string, value: string) {
  fireEvent.change(document.querySelector(`[name="${name}"]`) as HTMLInputElement, { target: { value } })
}

function fillValidForm(secret?: string) {
  fill('username', 'amenophis')
  fill('email', 'owner@example.org')
  fill('password', 'a-long-enough-password-9!')
  fill('confirmPassword', 'a-long-enough-password-9!')
  if (secret !== undefined) fill('secret', secret)
}

describe('ClaimPage', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('warns that the claim is open when no secret is required, and asks for none', () => {
    render(<ClaimPage secretRequired={false} onLoginSuccess={vi.fn()} />)

    expect(screen.getByRole('note').textContent).toContain('claim.openWarning')
    expect(document.querySelector('[name="secret"]')).toBeNull()
  })

  it('asks for the secret, and drops the open warning, when the deployment has one', () => {
    render(<ClaimPage secretRequired={true} onLoginSuccess={vi.fn()} />)

    expect(document.querySelector('[name="secret"]')).not.toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('refuses to submit mismatched passwords without calling the API', async () => {
    render(<ClaimPage secretRequired={false} onLoginSuccess={vi.fn()} />)
    fill('username', 'amenophis')
    fill('email', 'owner@example.org')
    fill('password', 'one-password-here-1!')
    fill('confirmPassword', 'a-different-one-2!')

    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    expect((await screen.findByRole('alert')).textContent).toContain('claim.passwordMismatch')
    expect(claimMock).not.toHaveBeenCalled()
  })

  it('claims, persists the session and signs in exactly like a login', async () => {
    const onLoginSuccess = vi.fn()
    claimMock.mockResolvedValue({
      success: true,
      data: { claimed: true, token: 'tok', refreshToken: 'ref', user: { id: 'user_1', username: 'amenophis' } },
    } as never)
    render(<ClaimPage secretRequired={true} onLoginSuccess={onLoginSuccess} />)
    fillValidForm('deploy-token')

    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith('tok', { id: 'user_1', username: 'amenophis' }))
    expect(claimMock).toHaveBeenCalledWith({
      username: 'amenophis',
      email: 'owner@example.org',
      password: 'a-long-enough-password-9!',
      secret: 'deploy-token',
    })
    expect(persistMock).toHaveBeenCalledWith('tok', 'ref')
  })

  it('sends no secret field when none is required', async () => {
    claimMock.mockResolvedValue({ success: true, data: { claimed: true, token: 't', user: {} } } as never)
    render(<ClaimPage secretRequired={false} onLoginSuccess={vi.fn()} />)
    fillValidForm()

    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(claimMock).toHaveBeenCalled())
    expect(claimMock.mock.calls[0][0].secret).toBeUndefined()
  })

  it('shows the server error when the claim is refused', async () => {
    claimMock.mockResolvedValue({ success: false, error: { message: 'Incorrect claim secret.' } } as never)
    const onLoginSuccess = vi.fn()
    render(<ClaimPage secretRequired={true} onLoginSuccess={onLoginSuccess} />)
    fillValidForm('wrong')

    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    expect((await screen.findByRole('alert')).textContent).toContain('Incorrect claim secret.')
    expect(onLoginSuccess).not.toHaveBeenCalled()
    expect(persistMock).not.toHaveBeenCalled()
  })

  it('hands off to the login form when the claim succeeded without a session', async () => {
    // Claimed, but no token came back. The user must not be left on a page that no longer applies.
    claimMock.mockResolvedValue({ success: true, data: { claimed: true } } as never)
    const onClaimedWithoutSession = vi.fn()
    const onLoginSuccess = vi.fn()
    render(<ClaimPage secretRequired={false} onLoginSuccess={onLoginSuccess} onClaimedWithoutSession={onClaimedWithoutSession} />)
    fillValidForm()

    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(onClaimedWithoutSession).toHaveBeenCalled())
    expect(onLoginSuccess).not.toHaveBeenCalled()
  })
})
