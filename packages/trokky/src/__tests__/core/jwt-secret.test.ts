import { describe, it, expect, vi, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import {
  resolveJwtSecret,
  isPlaceholderJwtSecret,
  resolveJwtSecretEnvironment,
  MIN_JWT_SECRET_LENGTH,
} from '../../core/security/jwt-secret.js'
import '../../adapters/filesystem-data/index.js'
import '../../adapters/filesystem-media/index.js'
import { TrokkyExpress } from '../../integrations/express/index.js'
import { TrokkyCore } from '../../core/core/engine.js'
import type { TrokkyConfig } from '../../core/types/index.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'
import { withDefaults, defineConfig } from '../../integrations/express/config.js'

const STRONG = 'k3Jx9pQ2vL7mN4rT8wY1zA6bC5dE0fGhIjKlMnOp'

function resolve(overrides: Partial<Parameters<typeof resolveJwtSecret>[0]> = {}) {
  const warn = vi.fn()
  const generate = vi.fn(() => 'generated-random-key')
  const secret = resolveJwtSecret({ environment: 'production', generate, warn, ...overrides })
  return { secret, warn, generate }
}

describe('resolveJwtSecret', () => {
  describe('in production', () => {
    it('should refuse to start without a secret', () => {
      expect(() => resolve({})).toThrow(/No JWT secret/)
    })

    it('should never fall back to a generated key', () => {
      const generate = vi.fn(() => 'generated-random-key')
      expect(() => resolveJwtSecret({ environment: 'production', generate, warn: vi.fn() })).toThrow()
      expect(generate).not.toHaveBeenCalled()
    })

    it.each([
      'change-me-in-production',
      'acme-secret-change-in-production',
      'your-super-secret-jwt-key-change-in-production',
      'dev-secret-change-in-production',
      'changeme',
      'secret',
      ' secret\n',
      'your-secret-key-here',
      'your_jwt_secret',
      'demo-dev-secret-do-not-use-in-production',
      'replace-me',
      'change-this-secret',
      'supersecret',
      'jwt-secret-key',
    ])('should refuse the placeholder %j', (placeholder) => {
      expect(() => resolve({ configured: placeholder })).toThrow(/placeholder/)
    })

    it('should sign with a non-blank secret exactly as given, surrounding whitespace included', () => {
      expect(resolve({ configured: ` ${STRONG}\n` }).secret).toBe(` ${STRONG}\n`)
    })

    it('should treat a blank secret as missing', () => {
      expect(() => resolve({ configured: '   ', fromEnv: '' })).toThrow(/No JWT secret/)
    })

    it('should prefer a real TROKKY_JWT_SECRET over a placeholder fallback in config', () => {
      expect(resolve({ configured: 'change-me-in-production', fromEnv: STRONG }).secret).toBe(STRONG)
    })

    it('should still refuse when both the config and TROKKY_JWT_SECRET are placeholders', () => {
      expect(() => resolve({ configured: 'change-me', fromEnv: 'your-secret' })).toThrow(/placeholder/)
    })

    it('should accept exactly the minimum length without a warning', () => {
      const exact = STRONG.slice(0, MIN_JWT_SECRET_LENGTH)
      const { secret, warn } = resolve({ configured: exact })
      expect(secret).toBe(exact)
      expect(warn).not.toHaveBeenCalled()
      expect(resolve({ configured: exact.slice(1) }).warn).toHaveBeenCalledOnce()
    })

    it('should use the configured secret before TROKKY_JWT_SECRET', () => {
      expect(resolve({ configured: STRONG, fromEnv: `${STRONG}-env` }).secret).toBe(STRONG)
    })

    it('should use TROKKY_JWT_SECRET when nothing is configured', () => {
      expect(resolve({ fromEnv: STRONG }).secret).toBe(STRONG)
    })

    it('should accept a short secret but warn about its length', () => {
      const short = 'Xq7#pL2v9Rk4'
      const { secret, warn } = resolve({ configured: short })
      expect(secret).toBe(short)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${short.length} characters`))
    })

    it('should not warn about a strong secret', () => {
      expect(STRONG.length).toBeGreaterThanOrEqual(MIN_JWT_SECRET_LENGTH)
      expect(resolve({ configured: STRONG }).warn).not.toHaveBeenCalled()
    })
  })

  describe('outside production', () => {
    it('should generate a key and warn in development', () => {
      const { secret, warn, generate } = resolve({ environment: 'development' })
      expect(secret).toBe('generated-random-key')
      expect(generate).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('TROKKY_JWT_SECRET'))
    })

    it('should generate a key silently in tests', () => {
      const { secret, warn } = resolve({ environment: 'test' })
      expect(secret).toBe('generated-random-key')
      expect(warn).not.toHaveBeenCalled()
    })

    it('should accept a placeholder outside production', () => {
      expect(resolve({ environment: 'development', configured: 'change-me' }).secret).toBe('change-me')
    })
  })

  describe('environment', () => {
    it.each([
      [['production'], 'production'],
      [['staging'], 'production'],
      [['Production '], 'production'],
      [['prod'], 'production'],
      [['development'], 'development'],
      [['dev'], 'development'],
      [['test'], 'test'],
      [[''], 'development'],
      [[undefined], 'development'],
      [['development', 'production'], 'production'],
      [['production', 'test'], 'production'],
      [['development', 'test'], 'development'],
      [[undefined, 'test'], 'test'],
    ] as const)('should resolve %j to %s', (sources, expected) => {
      expect(resolveJwtSecretEnvironment(...sources)).toBe(expected)
    })
  })

  it('should not mistake a random key for a placeholder', () => {
    expect(isPlaceholderJwtSecret(' secret\n')).toBe(true)
    expect(isPlaceholderJwtSecret(STRONG)).toBe(false)
    expect(isPlaceholderJwtSecret('8f1c2b9e7d6a4c3b2a1f0e9d8c7b6a5f')).toBe(false)
  })
})

describe('TrokkyCore JWT secret', () => {
  const config: TrokkyConfig = { storage: { adapter: 'mock', options: {} }, schemas: [] }
  const adapters = {
    data: {
      getDocument: vi.fn(), saveDocument: vi.fn(), listDocuments: vi.fn(), deleteDocument: vi.fn(),
      getUser: vi.fn(), saveUser: vi.fn(), listUsers: vi.fn(), deleteUser: vi.fn(),
      getUserByUsername: vi.fn(), getUserByEmail: vi.fn(), getAppToken: vi.fn(), saveAppToken: vi.fn(),
      listAppTokens: vi.fn(), deleteAppToken: vi.fn(), getAppTokenByHash: vi.fn(), getSettings: vi.fn(),
      healthCheck: vi.fn(),
    } as never,
    media: { uploadFile: vi.fn(), getFile: vi.fn(), getFileContent: vi.fn(), deleteFile: vi.fn(), healthCheck: vi.fn() } as never,
  }
  const signingKey = (core: TrokkyCore) => (core as unknown as { jwtSecret: string }).jwtSecret
  const create = (options: { jwtSecret?: string; env?: 'production' | 'development' | 'test' }) =>
    new TrokkyCore(config, adapters, { enableEvents: false, cryptoAdapter: new WebCryptoAdapter(), ...options })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should refuse to construct in production without a secret', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    expect(() => create({ env: 'production' })).toThrow(/No JWT secret/)
  })

  it('should read production from NODE_ENV when no env option is given', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => create({})).toThrow(/No JWT secret/)
  })

  it('should refuse a placeholder secret in production', () => {
    expect(() => create({ env: 'production', jwtSecret: 'change-me-in-production' })).toThrow(/placeholder/)
  })

  it('should sign with TROKKY_JWT_SECRET in production', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', STRONG)
    expect(signingKey(create({ env: 'production' }))).toBe(STRONG)
  })

  it('should apply the production rules when NODE_ENV says production and the option says development', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => create({ env: 'development' })).toThrow(/No JWT secret/)
  })

  it('should apply the production rules to an unrecognised NODE_ENV such as staging', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    vi.stubEnv('NODE_ENV', 'staging')
    expect(() => create({})).toThrow(/No JWT secret/)
  })

  it('should construct in development without a secret and log why sign-ins will not last', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.mocked(console.warn)
    warn.mockClear()
    const core = create({ env: 'development' })
    expect(signingKey(core)).toHaveLength(signingKey(create({ env: 'development' })).length)
    expect(warn.mock.calls.flat().join(' ')).toContain('using a random key for this process')
  })
})

describe('Express configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const base = {
    schemas: [{ name: 'post', type: 'document', fields: { title: { type: 'string' } } }],
    storage: { data: { adapter: 'filesystem-data' }, media: { adapter: 'filesystem-media' } },
  }

  it('should make TrokkyExpress.create refuse production without a secret', async () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-jwt-'))
    try {
      // env comes from the config alone: NODE_ENV stays 'test', so only the env the
      // integration hands the engine can trigger the refusal
      const boot = TrokkyExpress.create({
        ...base,
        env: 'production',
        storage: {
          data: { adapter: 'filesystem-data', options: { contentDir: path.join(dir, 'content'), usersDir: path.join(dir, 'users'), tokensDir: path.join(dir, 'tokens'), settingsDir: path.join(dir, 'settings'), webhooksDir: path.join(dir, 'webhooks'), authFlowStateDir: path.join(dir, 'flow') } },
          media: { adapter: 'filesystem-media', options: { mediaDir: path.join(dir, 'media') } },
        },
      } as never)
      await expect(boot).rejects.toThrow(/No JWT secret/)
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('should not supply a fixed development secret', () => {
    const full = withDefaults({ ...base, env: 'development' } as never)
    expect(full.security.jwtSecret).toBeUndefined()
  })

  it('should let defineConfig accept TROKKY_JWT_SECRET in production', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', STRONG)
    expect(() => defineConfig({ ...base, env: 'production' } as never)).not.toThrow()
  })

  it('should still make defineConfig refuse production with no secret at all', () => {
    vi.stubEnv('TROKKY_JWT_SECRET', '')
    expect(() => defineConfig({ ...base, env: 'production' } as never)).toThrow(/JWT secret/)
  })
})
