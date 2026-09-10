/**
 * Trokky Logging System
 * 
 * Platform-agnostic logger that works on:
 * - Node.js servers
 * - Edge functions (Cloudflare Workers, Vercel Edge)
 * - Serverless functions (AWS Lambda, Netlify)
 * - Browser environments
 * 
 * Features:
 * - Zero filesystem dependencies
 * - Structured logging (JSON when appropriate)
 * - Standard log levels
 * - Environment-based configuration
 * - Color support where available
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  package: string
  component?: string
  operation?: string
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  data?: any
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface LoggerConfig {
  level: LogLevel
  format: 'human' | 'json'
  timestamp: boolean
  colors: boolean
}

/**
 * Environment detection
 */
const isNode = typeof process !== 'undefined' && process.versions?.node
const isBrowser = typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined'
const isEdge = typeof globalThis !== 'undefined' && typeof (globalThis as any).EdgeRuntime !== 'undefined'
const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

/**
 * Default configuration based on environment
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: isDevelopment ? 'debug' : 'info',
  format: isDevelopment ? 'human' : 'json',
  timestamp: true,
  colors: Boolean(isNode && !isEdge && process.stdout?.isTTY)
}

/**
 * Log level hierarchy
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * ANSI colors (only used in appropriate environments)
 */
const COLORS = {
  debug: '\x1b[36m',   // Cyan
  info: '\x1b[32m',    // Green  
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  reset: '\x1b[0m',    // Reset
  gray: '\x1b[90m',    // Gray
  bold: '\x1b[1m'      // Bold
} as const

/**
 * Replacement used for redacted values
 */
const REDACTED = '[REDACTED]'

/**
 * Key names whose values are never written to logs.
 *
 * Matching is a case-insensitive EXACT match against this list, never a
 * substring match. This is deliberate: substring matching would also redact
 * innocuous fields such as `tokenCount`, `passwordPolicy` or
 * `secretsManagerRegion`, which destroys debuggability and makes redaction
 * unpredictable. New sensitive field names must be added to this list to be
 * redacted.
 *
 * A few entries are less obvious: an app token's `tokenHash` is the lookup key
 * accepted by `getAppTokenByHash`, so it is credential-equivalent rather than a
 * mere digest, and `userCode`/`deviceCode` are the one-time approval values of
 * the OAuth2 device flow.
 */
export const SENSITIVE_KEYS: readonly string[] = [
  'secret',
  'secrets',
  'token',
  'tokenHash',
  'token_hash',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'resetToken',
  'reset_token',
  'idToken',
  'id_token',
  'apiKey',
  'api_key',
  'apikey',
  'password',
  'passwordHash',
  'password_hash',
  'newPassword',
  'new_password',
  'currentPassword',
  'current_password',
  'temporaryPassword',
  'temporary_password',
  'authorization',
  'auth',
  'cookie',
  'setCookie',
  'set_cookie',
  'connectionString',
  'connection_string',
  'databaseUrl',
  'database_url',
  'privateKey',
  'private_key',
  'privateKeyPem',
  'salt',
  'credentials',
  'credential',
  'clientSecret',
  'client_secret',
  'clientAssertion',
  'client_assertion',
  'userCode',
  'user_code',
  'deviceCode',
  'device_code',
  'sessionToken',
  'session_token',
  'mfaSecret',
  'mfa_secret',
  'totpSecret',
  'totp_secret',
  'webhookSecret',
  'webhook_secret',
  'jwtSecret',
  'jwt_secret',
  'signature',
  'bearer',
  'passphrase'
]

const SENSITIVE_KEY_SET = new Set(SENSITIVE_KEYS.map(key => key.toLowerCase()))

/**
 * `ancestors` tracks only the objects currently being recursed into, so a true
 * cycle is detected while the same object referenced twice in different
 * branches (an acyclic DAG) is still rendered in full.
 */
function redactValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date || value instanceof Error) return value

  if (ancestors.has(value)) return '[Circular]'
  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      return value.map(item => redactValue(item, ancestors))
    }

    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_SET.has(key.toLowerCase())
        ? REDACTED
        : redactValue(nested, ancestors)
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

/**
 * Recursively replace values held under sensitive keys with '[REDACTED]'.
 *
 * Returns a new structure, leaving the input unmutated. Non-object values pass
 * through unchanged, and references back to an enclosing object become
 * '[Circular]'.
 */
export function redactSensitive(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>())
}

/**
 * Platform-agnostic logger
 */
export class TrokkyLogger {
  private config: LoggerConfig
  private context: LogContext

  constructor(context: LogContext, config: Partial<LoggerConfig> = {}) {
    this.context = context
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context
    }

    if (data !== undefined) {
      entry.data = redactSensitive(data)
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    return entry
  }

  private formatHuman(entry: LogEntry): string {
    const parts: string[] = []

    // Timestamp
    if (this.config.timestamp) {
      const time = entry.timestamp.slice(11, 23) // HH:mm:ss.SSS
      const timeStr = this.config.colors ? `${COLORS.gray}${time}${COLORS.reset}` : time
      parts.push(timeStr)
    }

    // Level with color
    const levelUpper = entry.level.toUpperCase().padEnd(5)
    const levelStr = this.config.colors 
      ? `${COLORS[entry.level]}${levelUpper}${COLORS.reset}`
      : levelUpper
    parts.push(levelStr)

    // Context
    const contextParts = [entry.context.package]
    if (entry.context.component) contextParts.push(entry.context.component)
    if (entry.context.operation) contextParts.push(entry.context.operation)
    
    const contextStr = this.config.colors
      ? `${COLORS.gray}[${contextParts.join(':')}]${COLORS.reset}`
      : `[${contextParts.join(':')}]`
    parts.push(contextStr)

    // Message
    parts.push(entry.message)

    return parts.join(' ')
  }

  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry)
  }

  private output(entry: LogEntry): void {
    const formatted = this.config.format === 'json' 
      ? this.formatJson(entry)
      : this.formatHuman(entry)

    // Use appropriate console method
    switch (entry.level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        if (entry.error?.stack && this.config.format === 'human') {
          console.error(entry.error.stack)
        }
        break
    }

    // Output data separately in human format
    if (entry.data && this.config.format === 'human') {
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2)
      console.log(dataStr)
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      this.output(this.createLogEntry('debug', message, data))
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      this.output(this.createLogEntry('info', message, data))
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      this.output(this.createLogEntry('warn', message, data))
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog('error')) {
      const actualError = error instanceof Error ? error : undefined
      const data = error instanceof Error ? undefined : error
      this.output(this.createLogEntry('error', message, data, actualError))
    }
  }

  child(context: Partial<LogContext>): TrokkyLogger {
    return new TrokkyLogger(
      { ...this.context, ...context },
      this.config
    )
  }

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * Global logger factory
 */
export class LoggerFactory {
  private static globalConfig: Partial<LoggerConfig> = {}

  static configure(config: Partial<LoggerConfig>): void {
    LoggerFactory.globalConfig = { ...LoggerFactory.globalConfig, ...config }
  }

  static create(context: LogContext): TrokkyLogger {
    return new TrokkyLogger(context, LoggerFactory.globalConfig)
  }

  static setLevel(level: LogLevel): void {
    LoggerFactory.configure({ level })
  }

  static setFormat(format: 'human' | 'json'): void {
    LoggerFactory.configure({ format })
  }

  static disable(): void {
    LoggerFactory.configure({ level: 'error' })
  }
}

/**
 * Convenience function to create package loggers
 */
export function createLogger(package_name: string, component?: string): TrokkyLogger {
  return LoggerFactory.create({ package: package_name, component })
}

/**
 * Environment-specific configuration helpers
 */
export const LoggerPresets = {
  development: { level: 'debug' as LogLevel, format: 'human' as const, colors: true },
  production: { level: 'info' as LogLevel, format: 'json' as const, colors: false },
  testing: { level: 'warn' as LogLevel, format: 'human' as const, colors: false },
  edge: { level: 'info' as LogLevel, format: 'json' as const, colors: false }
} as const