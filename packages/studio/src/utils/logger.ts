/**
 * Studio Logger - Browser-optimized logging
 * 
 * Lightweight logger for Studio frontend components.
 * Integrates with browser dev tools and provides structured output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface StudioLoggerConfig {
  level: LogLevel
  enabled: boolean
  prefix: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// Default to info level in production, debug in development
const DEFAULT_LEVEL: LogLevel = (import.meta as any).env?.DEV ? 'debug' : 'info'

export class StudioLogger {
  private config: StudioLoggerConfig

  constructor(component: string, config: Partial<StudioLoggerConfig> = {}) {
    this.config = {
      level: DEFAULT_LEVEL,
      enabled: true,
      prefix: `[Studio:${component}]`,
      ...config
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private formatMessage(_level: LogLevel, message: string): string {
    return `${this.config.prefix} ${message}`
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message)
      if (data) {
        console.debug(formatted, data)
      } else {
        console.debug(formatted)
      }
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message)
      if (data) {
        console.info(formatted, data)
      } else {
        console.info(formatted)
      }
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message)
      if (data) {
        console.warn(formatted, data)
      } else {
        console.warn(formatted)
      }
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message)
      if (error instanceof Error) {
        console.error(formatted, error)
      } else if (error) {
        console.error(formatted, error)
      } else {
        console.error(formatted)
      }
    }
  }
}

/**
 * Create a logger for a Studio component
 */
export function createStudioLogger(component: string): StudioLogger {
  return new StudioLogger(component)
}

/**
 * Global configuration for all Studio loggers
 */
export const StudioLoggerConfig = {
  setLevel(_level: LogLevel): void {
    // Note: This affects only new loggers created after this call
    // Could be enhanced to update existing loggers if needed
  },
  
  disable(): void {
    // Could set a global flag to disable all logging
  }
}