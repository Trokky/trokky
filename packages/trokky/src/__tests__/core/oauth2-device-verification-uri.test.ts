/**
 * The device flow's verification_uri used to be hard-coded to `${issuer}/studio/auth/device`.
 * Since 3.0 the site decides where Studio is mounted, so the URI is configurable and the old
 * value is only the default.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { OAuth2AuthorizationServer as AuthorizationServer } from '../../core/security/oauth2/authorization-server.js'

describe('OAuth2 device flow verification URI', () => {
  const servers: AuthorizationServer[] = []
  afterEach(() => {
    for (const s of servers.splice(0)) s.stopCleanup()
  })

  const make = (extra: Record<string, unknown> = {}) => {
    const server = new AuthorizationServer({ issuer: 'https://cms.example.com', jwtSecret: 'test-secret', ...extra } as any)
    servers.push(server)
    return server
  }

  it('defaults to the Studio device page under /studio', () => {
    const result = make().startDeviceAuthorization('trokky-cli', [])
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.response.verification_uri).toBe('https://cms.example.com/studio/auth/device')
    expect(result.response.verification_uri_complete).toBe(
      `https://cms.example.com/studio/auth/device?code=${result.response.user_code}`
    )
  })

  it('uses the configured verificationUri when Studio is mounted elsewhere', () => {
    const result = make({ verificationUri: 'https://cms.example.com/admin/auth/device' }).startDeviceAuthorization('trokky-cli', [])
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.response.verification_uri).toBe('https://cms.example.com/admin/auth/device')
    expect(result.response.verification_uri_complete).toMatch(/^https:\/\/cms\.example\.com\/admin\/auth\/device\?code=/)
  })
})
