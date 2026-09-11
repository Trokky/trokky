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
 * Guards against pathological payloads. Logging must never be the thing that
 * takes a request down, so deep or very large structures are truncated rather
 * than followed, and an accessor that throws is reported rather than rethrown.
 */
const MAX_DEPTH = 10
const MAX_NODES = 5000

/**
 * Key names whose values are never written to logs.
 *
 * Keys are normalised before comparison - lowercased, with `-`, `_` and spaces
 * removed - so `setCookie`, `set_cookie` and the wire-format `set-cookie` all
 * match one entry. Matching is still EXACT on that normalised form, never a
 * substring match: substring matching would also redact innocuous fields such
 * as `tokenCount`, `passwordPolicy` or `secretsManagerRegion`, which destroys
 * debuggability and makes redaction unpredictable.
 *
 * A few entries are less obvious. An app token's `tokenHash` is the lookup key
 * accepted by `getAppTokenByHash`, so it is credential-equivalent rather than a
 * mere digest. `userCode`/`deviceCode` are the one-time approval values of the
 * OAuth2 device flow.
 *
 * `auth` and `credential` are deliberately included even though they sometimes
 * hold non-secret values - a route's auth mode, a WebAuthn response. Hiding a
 * diagnostic field is recoverable; printing a credential is not.
 */
export const SENSITIVE_KEYS: readonly string[] = [
  'secret',
  'secrets',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'resetToken',
  'idToken',
  'sessionToken',
  'apiKey',
  'xApiKey',
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'temporaryPassword',
  'passphrase',
  'authorization',
  'proxyAuthorization',
  'wwwAuthenticate',
  'auth',
  'bearer',
  'cookie',
  'setCookie',
  'connectionString',
  'databaseUrl',
  'privateKey',
  'privateKeyPem',
  'salt',
  'credential',
  'credentials',
  'clientSecret',
  'clientAssertion',
  'userCode',
  'deviceCode',
  'mfaSecret',
  'totpSecret',
  'webhookSecret',
  'jwtSecret',
  'signature'
]

/**
 * Collapse the spellings a key arrives in - camelCase, snake_case and the
 * hyphenated wire format used by real HTTP headers - onto one form.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '')
}

const SENSITIVE_KEY_SET = new Set(SENSITIVE_KEYS.map(normalizeKey))

interface RedactionBudget {
  ancestors: WeakSet<object>
  nodes: number
}

/**
 * Read one own property without trusting it.
 *
 * `Object.entries` invokes every enumerable getter, which means a throwing
 * accessor would take down the log call and a side-effecting one would run as
 * a consequence of logging. Descriptors let us see what a property is before
 * deciding whether to touch it - and a getter under a sensitive key is never
 * invoked at all.
 */
function readOwnProperty(source: object, key: string): { ok: boolean; value?: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(source, key)
  if (!descriptor) return { ok: false }
  if ('value' in descriptor) return { ok: true, value: descriptor.value }
  if (typeof descriptor.get !== 'function') return { ok: false }
  try {
    return { ok: true, value: descriptor.get.call(source) }
  } catch {
    return { ok: false }
  }
}

/**
 * Errors are rebuilt rather than passed through.
 *
 * Returning the Error itself leaked twice over: any attached context survived
 * redaction (`err.config.headers.authorization` is the common shape), and
 * `message`/`stack` are non-enumerable so a JSON serializer rendered the whole
 * thing as `{}`. Rebuilding fixes both - the diagnostic fields are carried
 * explicitly and everything hung off the error is redacted like any payload.
 */
function sanitizeError(error: Error, budget: RedactionBudget, depth: number): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null)
  result.name = error.name
  result.message = error.message
  if (error.stack) result.stack = error.stack

  for (const key of Object.keys(error)) {
    if (key === 'name' || key === 'message' || key === 'stack') continue
    if (SENSITIVE_KEY_SET.has(normalizeKey(key))) {
      result[key] = REDACTED
      continue
    }
    const read = readOwnProperty(error, key)
    result[key] = read.ok ? redactValue(read.value, budget, depth + 1) : '[Unreadable]'
  }

  const cause = (error as Error & { cause?: unknown }).cause
  if (cause !== undefined) {
    result.cause = redactValue(cause, budget, depth + 1)
  }

  return result
}

/**
 * `ancestors` tracks only the objects currently being recursed into, so a true
 * cycle is detected while the same object referenced twice in different
 * branches (an acyclic DAG) is still rendered in full.
 */
function redactValue(value: unknown, budget: RedactionBudget, depth: number): unknown {
  // A copied function is not inert: an own `toJSON` would be invoked by the
  // serializer and could hand back the very object we just redacted.
  if (typeof value === 'function') return '[Function]'
  if (value === null || typeof value !== 'object') return value

  // Date's toJSON lives on the prototype, is not copied, and yields an ISO
  // string, so dates are safe to pass through untouched.
  if (value instanceof Date) return value

  if (depth > MAX_DEPTH) return '[Max depth exceeded]'
  if (budget.nodes >= MAX_NODES) return '[Truncated]'
  budget.nodes++

  if (budget.ancestors.has(value)) return '[Circular]'
  budget.ancestors.add(value)

  try {
    if (value instanceof Error) {
      return sanitizeError(value, budget, depth)
    }

    // Not traversed: their contents are invisible to JSON anyway, and walking
    // them would add leak surface for no diagnostic gain. Say so plainly
    // instead of rendering a misleading empty object.
    if (value instanceof Map) return '[Map]'
    if (value instanceof Set) return '[Set]'

    if (Array.isArray(value)) {
      return value.map(item => redactValue(item, budget, depth + 1))
    }

    // Null prototype: an own `__proto__` key copied onto a normal object would
    // otherwise reassign the clone's prototype.
    const result: Record<string, unknown> = Object.create(null)
    for (const key of Object.keys(value)) {
      if (SENSITIVE_KEY_SET.has(normalizeKey(key))) {
        result[key] = REDACTED
        continue
      }
      const read = readOwnProperty(value, key)
      result[key] = read.ok ? redactValue(read.value, budget, depth + 1) : '[Unreadable]'
    }
    return result
  } finally {
    budget.ancestors.delete(value)
  }
}

/**
 * Recursively replace values held under sensitive keys with '[REDACTED]'.
 *
 * Returns a new structure, leaving the input unmutated. The result is inert:
 * no functions are carried over, so nothing in it can execute during
 * serialization and reintroduce what was removed.
 */
export function redactSensitive(value: unknown): unknown {
  return redactValue(value, { ancestors: new WeakSet<object>(), nodes: 0 }, 0)
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