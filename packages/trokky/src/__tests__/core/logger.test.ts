import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, TrokkyLogger, LoggerFactory, LoggerPresets } from '../../core/utils/logger.js'

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
})
