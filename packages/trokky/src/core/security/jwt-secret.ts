/**
 * Where the JWT signing key comes from, and what happens when it is missing.
 *
 * The key signs every session and API token, so whoever knows it can mint an admin token.
 * Two fallbacks used to hide its absence: a random key generated without a word (sessions
 * then die at every restart and replicas reject each other's tokens), and on Express a
 * fixed development key that was public. Production now refuses to start without a real
 * key; development and tests still get a random one.
 */

export type JwtSecretEnvironment = 'development' | 'production' | 'test'

/**
 * Placeholder values copied from examples and left in place. The unanchored patterns are
 * long enough that a random key matching one by chance is not a realistic concern.
 */
const PLACEHOLDER_PATTERNS = [
  /change[-_ ]?(me|this)/i,
  /change[-_ ]?(it[-_ ]?)?in[-_ ]?prod/i,
  /replace[-_ ]?(me|this)/i,
  /do[-_ ]?not[-_ ]?use/i,
  /not[-_ ]?for[-_ ]?prod/i,
  /your[-_ ]?(jwt[-_ ]?|super[-_ ]?)?secret/i,
  /dev[-_ ]?secret/i,
  /insecure/i,
  /^(my|super)?[-_ ]?secret([-_ ]?key)?\d*$/i,
  /^jwt[-_ ]?secret([-_ ]?key)?\d*$/i,
  /^(password|passw0rd|changeme|default|example|test|dev|admin)\d*$/i,
]

/** Below this many characters a production key is accepted with a warning. */
export const MIN_JWT_SECRET_LENGTH = 32

export interface ResolveJwtSecretOptions {
  /** The key from configuration (security.jwtSecret or the engine option). */
  configured?: string
  /** TROKKY_JWT_SECRET, when the runtime has a process environment. */
  fromEnv?: string
  environment: JwtSecretEnvironment
  generate: () => string
  warn: (message: string) => void
}

export function isPlaceholderJwtSecret(secret: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(secret.trim()))
}

/**
 * Map an environment name to the three the secret rules know. Only names that clearly mean a
 * developer's machine or a test run escape the production rules: `staging`, `prod` or a typo
 * is a deployment, and a deployment must have a real key.
 */
export function normalizeJwtSecretEnvironment(value: string | undefined): JwtSecretEnvironment | undefined {
  const name = value?.trim().toLowerCase()
  if (!name) return undefined
  if (name === 'development' || name === 'dev' || name === 'local') return 'development'
  if (name === 'test' || name === 'testing') return 'test'
  return 'production'
}

/**
 * The environment the secret rules apply. Production if any source says so, so a config
 * left on `env: 'development'` cannot switch the check off on a server running with
 * NODE_ENV=production.
 */
export function resolveJwtSecretEnvironment(...sources: Array<string | undefined>): JwtSecretEnvironment {
  const named = sources.map(normalizeJwtSecretEnvironment).filter((env) => env !== undefined)
  if (named.includes('production')) return 'production'
  return named[0] ?? 'development'
}

const SET_IT =
  'Set TROKKY_JWT_SECRET (or whichever variable your trokky.config.ts passes to security.jwtSecret) ' +
  'to a random value, for example the output of `openssl rand -base64 48`.'

export function resolveJwtSecret(options: ResolveJwtSecretOptions): string {
  // Blank counts as unset, but a non-blank key is used byte for byte: trimming it would change
  // the signing key on upgrade and invalidate every token already issued.
  const configured = options.configured?.trim() ? options.configured : undefined
  const fromEnv = options.fromEnv?.trim() ? options.fromEnv : undefined
  // A config that falls back to an example value (`process.env.X || 'change-me'`) must not
  // outrank a real TROKKY_JWT_SECRET: the operator who set it did what the error asked.
  const secret =
    configured && isPlaceholderJwtSecret(configured) && fromEnv && !isPlaceholderJwtSecret(fromEnv)
      ? fromEnv
      : configured || fromEnv

  if (options.environment === 'production') {
    if (!secret) {
      throw new Error(
        `No JWT secret. ${SET_IT} Trokky refuses to start in production without one: a generated key ` +
          'would sign everyone out at every restart, and replicas would reject each other\'s tokens.'
      )
    }
    if (isPlaceholderJwtSecret(secret)) {
      throw new Error(
        'The JWT secret is a placeholder value, and anyone who has read the example it came from can ' +
          `sign tokens for this site. ${SET_IT}`
      )
    }
    if (secret.length < MIN_JWT_SECRET_LENGTH) {
      options.warn(
        `The JWT secret is ${secret.length} characters long. Use at least ${MIN_JWT_SECRET_LENGTH} random ` +
          'characters, for example the output of `openssl rand -base64 48`.'
      )
    }
    return secret
  }

  if (secret) return secret

  if (options.environment === 'development') {
    options.warn(
      'No JWT secret set (TROKKY_JWT_SECRET): using a random key for this process, so Studio sign-ins ' +
        'end whenever the server restarts. Set TROKKY_JWT_SECRET in .env (.dev.vars on Workers) to keep them.'
    )
  }
  return options.generate()
}
