import { describe, expect, it } from 'vitest'
import { pollLogin, siteNameFromUrl, startLogin, type PendingLogin } from '../device.js'

const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status })
const started = { device_code: 'd', user_code: 'ABCD-EFGH', verification_uri_complete: 'https://x/auth/device?code=ABCD-EFGH', interval: 1, expires_in: 600 }

describe('startLogin', () => {
  it('falls back to the CLI client only on a server that has never heard of the MCP one', async () => {
    const clients: string[] = []
    const login = await startLogin('https://x/api', 'read', async (_url, init) => {
      const { client_id } = JSON.parse(String(init?.body))
      clients.push(client_id)
      return client_id === 'trokky-mcp' ? reply({ error: 'invalid_client', error_description: 'Unknown client_id' }, 400) : reply(started)
    })
    expect(clients).toEqual(['trokky-mcp', 'trokky-cli'])
    expect(login.clientId).toBe('trokky-cli')
  })

  it('does not work around a server that refuses the MCP client', async () => {
    // The CLI client would be accepted, but a site that switched the agent client off meant it
    await expect(startLogin('https://x/api', 'read', async (_url, init) =>
      JSON.parse(String(init?.body)).client_id === 'trokky-mcp'
        ? reply({ error: 'invalid_client', error_description: 'Client is not active' }, 400)
        : reply(started))).rejects.toThrow('refused')
  })

  it('explains a site without OAuth2', async () => {
    await expect(startLogin('https://x/api', 'read', async () => reply({}, 501))).rejects.toThrow('oauth2.enabled')
  })
})

describe('pollLogin', () => {
  const login = (): PendingLogin => ({ apiUrl: 'https://x/api', clientId: 'trokky-mcp', deviceCode: 'd', userCode: 'c', verificationUrl: 'u', intervalMs: 1000, expiresAt: Date.now() + 60_000 })

  it('tells pending, slow down, denied and expired apart', async () => {
    expect(await pollLogin(login(), async () => reply({ error: 'authorization_pending' }, 400))).toEqual({ status: 'pending', slowDown: false })
    expect(await pollLogin(login(), async () => reply({ error: 'slow_down' }, 400))).toEqual({ status: 'pending', slowDown: true })
    expect(await pollLogin(login(), async () => reply({ error: 'access_denied' }, 400))).toEqual({ status: 'failed', reason: 'The sign-in was denied.' })
    expect((await pollLogin({ ...login(), expiresAt: Date.now() - 1 }, async () => reply({}))).status).toBe('failed')
  })
})

describe('siteNameFromUrl', () => {
  it('names a site as the CLI does', () => {
    expect(siteNameFromUrl('https://cms.example.com/api')).toBe('cms')
    expect(siteNameFromUrl('https://www.cms.example.com/api')).toBe('cms')
    expect(siteNameFromUrl('http://localhost:3253/api')).toBe('localhost-3253')
  })
})
