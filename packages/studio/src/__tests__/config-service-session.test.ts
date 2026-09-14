/**
 * studio.session is served by the server as `sessionConfig` on GET /config/studio,
 * and useAuth reads it from window.TROKKY_CONFIG. The config service is the only
 * thing that copies API config into the window, so if it copies branding alone the
 * setting is silently inert. This pins that it copies the session tuning too.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { StudioConfigService } from '@/services/config-service'

describe('StudioConfigService window merge', () => {
  beforeEach(() => {
    ;(window as any).TROKKY_CONFIG = { basePath: '/studio', branding: { title: 'Bootstrap' } }
  })

  it('lands branding and sessionConfig from the API in the window config', async () => {
    const client = {
      get: async () => ({
        success: true,
        data: {
          studioConfig: {
            branding: { title: 'From API', logo: '/logo.png' },
            sessionConfig: { refreshBufferMs: 300000, warningBufferMs: 0, checkIntervalMs: 30000, inactivityTimeoutMs: 3600000 },
          },
        },
      }),
    } as any

    await new StudioConfigService(client).fetchAndMergeConfig()

    const cfg = (window as any).TROKKY_CONFIG
    expect(cfg.basePath).toBe('/studio')
    expect(cfg.branding).toEqual({ title: 'From API', logo: '/logo.png' })
    expect(cfg.sessionConfig).toEqual({ refreshBufferMs: 300000, warningBufferMs: 0, checkIntervalMs: 30000, inactivityTimeoutMs: 3600000 })
  })

  it('leaves the window untouched when the API has no session tuning', async () => {
    const client = { get: async () => ({ success: true, data: { studioConfig: { branding: {} } } }) } as any
    await new StudioConfigService(client).fetchAndMergeConfig()
    expect((window as any).TROKKY_CONFIG.sessionConfig).toBeUndefined()
  })
})
