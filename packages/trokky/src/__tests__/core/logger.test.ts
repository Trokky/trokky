import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createLogger,
  TrokkyLogger,
  LoggerFactory,
  LoggerPresets,
  redactSensitive,
  SENSITIVE_KEYS,
} from '../../core/utils/logger.js'

describe('Logger', () => {
  let debugSpy: any
  let infoSpy: any
  let warnSpy: any
  let errorSpy: any

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createLogger', () => {
    it('should create a logger with package name', () => {
      const logger = createLogger('core')
      expect(logger).toBeInstanceOf(TrokkyLogger)
    })

    it('should create a logger with package and component', () => {
      const logger = createLogger('express', 'TrokkyExpress')
      expect(logger).toBeInstanceOf(TrokkyLogger)
    })
  })

  describe('TrokkyLogger', () => {
    let logger: TrokkyLogger

    beforeEach(() => {
      logger = new TrokkyLogger(
        { package: 'test', component: 'TestComponent' },
        { level: 'debug', format: 'human', colors: false }
      )
    })

    it('should log debug messages via console.debug', () => {
      logger.debug('Debug message')
      expect(debugSpy).toHaveBeenCalled()
    })

    it('should log info messages via console.info', () => {
      logger.info('Info message')
      expect(infoSpy).toHaveBeenCalled()
    })

    it('should log warn messages via console.warn', () => {
      logger.warn('Warning message')
      expect(warnSpy).toHaveBeenCalled()
    })

    it('should log error messages via console.error', () => {
      logger.error('Error message', new Error('test error'))
      expect(errorSpy).toHaveBeenCalled()
    })

    it('should respect log level filtering', () => {
      const warnLogger = new TrokkyLogger(
        { package: 'test' },
        { level: 'warn', format: 'human', colors: false }
      )

      warnLogger.debug('Should not appear')
      warnLogger.info('Should not appear')
      expect(debugSpy).not.toHaveBeenCalled()
      expect(infoSpy).not.toHaveBeenCalled()

      warnLogger.warn('Should appear')
      expect(warnSpy).toHaveBeenCalled()
    })

    it('should create child loggers', () => {
      const child = logger.child({ operation: 'save' })
      expect(child).toBeInstanceOf(TrokkyLogger)
      child.info('Child log')
      expect(infoSpy).toHaveBeenCalled()
    })

    it('should include data in log output', () => {
      logger.info('With data', { userId: '123' })
      expect(infoSpy).toHaveBeenCalled()
      const output = infoSpy.mock.calls[0][0]
      expect(output).toContain('With data')
    })

    it('should format output in human mode', () => {
      logger.info('Test message')
      const output = infoSpy.mock.calls[0][0]
      expect(output).toContain('INFO')
      expect(output).toContain('test:TestComponent')
      expect(output).toContain('Test message')
    })

    it('should format output in JSON mode', () => {
      const jsonLogger = new TrokkyLogger(
        { package: 'test' },
        { level: 'debug', format: 'json', colors: false }
      )
      jsonLogger.info('JSON log')
      const output = infoSpy.mock.calls[0][0]
      const parsed = JSON.parse(output)
      expect(parsed.message).toBe('JSON log')
      expect(parsed.level).toBe('info')
    })
  })

  describe('LoggerPresets', () => {
    it('should have development preset', () => {
      expect(LoggerPresets.development.level).toBe('debug')
      expect(LoggerPresets.development.format).toBe('human')
    })

    it('should have production preset', () => {
      expect(LoggerPresets.production.level).toBe('info')
      expect(LoggerPresets.production.format).toBe('json')
    })

    it('should have testing preset', () => {
      expect(LoggerPresets.testing.level).toBe('warn')
    })

    it('should have edge preset', () => {
      expect(LoggerPresets.edge.level).toBe('info')
      expect(LoggerPresets.edge.format).toBe('json')
    })
  })

  describe('LoggerFactory', () => {
    it('should create loggers', () => {
      const logger = LoggerFactory.create({ package: 'test' })
      expect(logger).toBeInstanceOf(TrokkyLogger)
    })
  })

  describe('redactSensitive', () => {
    it('should replace values under sensitive keys with a placeholder', () => {
      const redacted = redactSensitive({
        id: 'wh-1',
        secret: 'placeholder-secret-value',
      }) as Record<string, unknown>

      expect(redacted.id).toBe('wh-1')
      expect(redacted.secret).toBe('[REDACTED]')
    })

    it('should match key names case-insensitively', () => {
      const redacted = redactSensitive({
        Password: 'test-secret',
        ACCESS_TOKEN: 'test-secret',
        ApiKey: 'test-secret',
      }) as Record<string, unknown>

      expect(redacted.Password).toBe('[REDACTED]')
      expect(redacted.ACCESS_TOKEN).toBe('[REDACTED]')
      expect(redacted.ApiKey).toBe('[REDACTED]')
    })

    it('should redact inside nested objects', () => {
      const redacted = redactSensitive({
        webhook: {
          url: 'https://example.com/hook',
          headers: { authorization: 'Bearer test-secret' },
        },
      }) as { webhook: { url: string; headers: Record<string, unknown> } }

      expect(redacted.webhook.url).toBe('https://example.com/hook')
      expect(redacted.webhook.headers.authorization).toBe('[REDACTED]')
    })

    it('should redact inside arrays of objects and keep them arrays', () => {
      const redacted = redactSensitive({
        webhooks: [
          { id: 'wh-1', secret: 'placeholder-secret-value' },
          { id: 'wh-2', secret: 'placeholder-secret-value' },
        ],
      }) as { webhooks: Array<Record<string, unknown>> }

      expect(Array.isArray(redacted.webhooks)).toBe(true)
      expect(redacted.webhooks).toHaveLength(2)
      expect(redacted.webhooks[0].id).toBe('wh-1')
      expect(redacted.webhooks[0].secret).toBe('[REDACTED]')
      expect(redacted.webhooks[1].secret).toBe('[REDACTED]')
    })

    it('should pass non-object values through unchanged without throwing', () => {
      expect(redactSensitive(null)).toBeNull()
      expect(redactSensitive(undefined)).toBeUndefined()
      expect(redactSensitive(42)).toBe(42)
      expect(redactSensitive('plain string')).toBe('plain string')
      expect(redactSensitive(true)).toBe(true)
      const fn = (): string => 'noop'
      expect(redactSensitive(fn)).toBe(fn)
    })

    it('should preserve Date and Error instances as-is', () => {
      const date = new Date('2026-01-01T00:00:00Z')
      const error = new Error('boom')
      expect(redactSensitive(date)).toBe(date)
      expect(redactSensitive(error)).toBe(error)

      const redacted = redactSensitive({ updatedAt: date }) as Record<string, unknown>
      expect(redacted.updatedAt).toBe(date)
    })

    // Matching is an exact key match by design: substring matching would redact
    // innocuous, useful fields and make log output unpredictable.
    it('should NOT redact keys that merely contain a sensitive substring', () => {
      const redacted = redactSensitive({
        tokenCount: 12,
        passwordPolicy: { minLength: 8 },
        secretsManagerRegion: 'local',
        authorized: true,
      }) as Record<string, unknown>

      expect(redacted.tokenCount).toBe(12)
      expect(redacted.passwordPolicy).toEqual({ minLength: 8 })
      expect(redacted.secretsManagerRegion).toBe('local')
      expect(redacted.authorized).toBe(true)
    })

    it('should not hang on circular references', () => {
      const input: Record<string, unknown> = { id: 'wh-1', token: 'test-secret' }
      input.self = input

      const redacted = redactSensitive(input) as Record<string, unknown>
      expect(redacted.id).toBe('wh-1')
      expect(redacted.token).toBe('[REDACTED]')
      expect(redacted.self).toBe('[Circular]')
    })

    it('should render a repeated but acyclic reference in full', () => {
      const shared = { a: 1 }
      const redacted = redactSensitive({ x: shared, y: shared }) as Record<string, unknown>

      expect(redacted.x).toEqual({ a: 1 })
      expect(redacted.y).toEqual({ a: 1 })
    })

    it('should redact newly added credential-equivalent keys', () => {
      const redacted = redactSensitive({
        tokenHash: 'test-secret',
        resetToken: 'test-secret',
        temporaryPassword: 'test-secret',
        userCode: 'test-secret',
        deviceCode: 'test-secret',
        clientAssertion: 'test-secret',
        privateKeyPem: 'test-secret',
        salt: 'test-secret',
      }) as Record<string, unknown>

      for (const value of Object.values(redacted)) {
        expect(value).toBe('[REDACTED]')
      }
    })

    it('should not mutate the input object', () => {
      const input = {
        id: 'wh-1',
        secret: 'placeholder-secret-value',
        nested: { password: 'placeholder-secret-value' },
      }

      const redacted = redactSensitive(input) as Record<string, unknown>

      expect(input.secret).toBe('placeholder-secret-value')
      expect(input.nested.password).toBe('placeholder-secret-value')
      expect(redacted).not.toBe(input)
    })

    it('should expose the sensitive key list', () => {
      expect(SENSITIVE_KEYS).toContain('secret')
      expect(SENSITIVE_KEYS).toContain('password')
      expect(SENSITIVE_KEYS).toContain('authorization')
    })
  })

  describe('logger redaction at log time', () => {
    it('should redact secrets in data for every level', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const jsonLogger = new TrokkyLogger(
        { package: 'test' },
        { level: 'debug', format: 'json', colors: false }
      )

      jsonLogger.info('Webhook registered', {
        id: 'wh-1',
        secret: 'placeholder-secret-value',
      })

      const output = infoSpy.mock.calls[0][0] as string
      expect(output).toContain('[REDACTED]')
      expect(output).not.toContain('placeholder-secret-value')

      jsonLogger.debug('Debug', { token: 'placeholder-secret-value' })
      expect(debugSpy.mock.calls[0][0]).not.toContain('placeholder-secret-value')

      jsonLogger.warn('Warn', { apiKey: 'placeholder-secret-value' })
      expect(warnSpy.mock.calls[0][0]).not.toContain('placeholder-secret-value')

      jsonLogger.error('Error', { password: 'placeholder-secret-value' })
      expect(errorSpy.mock.calls[0][0]).not.toContain('placeholder-secret-value')

      logSpy.mockRestore()
    })

    it('should keep error name, message and stack handling intact', () => {
      const jsonLogger = new TrokkyLogger(
        { package: 'test' },
        { level: 'debug', format: 'json', colors: false }
      )

      jsonLogger.error('Failed', new Error('boom'))

      const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string)
      expect(parsed.error.name).toBe('Error')
      expect(parsed.error.message).toBe('boom')
      expect(typeof parsed.error.stack).toBe('string')
    })
  })
})
