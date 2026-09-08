import type { CryptoAdapter } from '../crypto/adapter.js'
import type { TrokkyLogger } from '../utils/logger.js'
import type { AuditEvent } from '../core/engine.js'
import type { MFARequirement } from './mfa-service.js'
import type { TOTPService } from '../security/mfa/index.js'
import type {
  AppToken,
  AuthenticationResult,
  AuthenticationSuccessResult,
  MFAMethodType,
  TrokkyConfig,
  TrustedDevice,
  UpdateUserData,
  User,
  UserSession
} from '../types/index.js'

export interface AuthServiceDependencies {
  cryptoAdapter: CryptoAdapter
  jwtSecret: string
  config: TrokkyConfig
  logger: TrokkyLogger
  getUser: (id: string) => Promise<User | null>
  getUserByUsername: (username: string) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>
  /** Conditional update, present only when the data adapter supports saveUserIf */
  updateUserIf?: (
    id: string,
    userData: Partial<UpdateUserData>,
    condition: { passwordHash: string }
  ) => Promise<User | null>
  validateAppToken: (token: string) => Promise<{ valid: boolean; appToken?: AppToken; error?: string }>
  logAuditEvent: (event: AuditEvent) => void
  checkMFARequired: (userId: string) => Promise<MFARequirement>
  isDeviceTrusted: (userId: string, deviceId: string) => Promise<boolean>
  trustDevice: (
    userId: string,
    deviceId: string,
    deviceName: string,
    options?: { ipAddress?: string; userAgent?: string }
  ) => Promise<TrustedDevice>
  getTOTPService: (issuer?: string) => TOTPService
}

/**
 * Authentication service: password verification, JWT issuance and the
 * login flows (including MFA hand-off). Extracted from TrokkyCore.
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDependencies) {}

  // Authentication utilities
  public async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await this.deps.cryptoAdapter.verifyPassword(plainPassword, hashedPassword)
  }

  /**
   * Hash a password using the configured crypto adapter
   * Exposed publicly to ensure consistent hashing across all password operations
   */
  public async hashPassword(password: string): Promise<string> {
    return await this.deps.cryptoAdapter.hashPassword(password)
  }

  public checkWeakPassword(password: string): { isWeak: boolean; reason?: string } {
    // Common weak passwords
    const commonPasswords = [
      'password', 'admin', 'changeme', 'changeme123', '123456',
      'qwerty', 'abc123', 'password123', 'admin123', 'letmein',
      'welcome', 'monkey', 'dragon', 'master', 'secret'
    ]

    // Check if password is too short
    if (password.length < 8) {
      return { isWeak: true, reason: 'Password is too short (minimum 8 characters)' }
    }

    // Check for common weak passwords
    if (commonPasswords.includes(password.toLowerCase())) {
      return { isWeak: true, reason: 'Password is a common weak password' }
    }

    // Check for simple patterns
    if (/^(.)\1+$/.test(password)) {
      return { isWeak: true, reason: 'Password contains only repeated characters' }
    }

    if (/^(012|123|234|345|456|567|678|789|890|abc|def|qwe|asd|zxc)/i.test(password)) {
      return { isWeak: true, reason: 'Password contains sequential characters' }
    }

    // Warn if password is short (8-11 characters) even if not technically weak
    if (password.length < 12) {
      return { isWeak: true, reason: 'Password is shorter than recommended (12+ characters)' }
    }

    // Check password complexity
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

    const complexityCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length

    if (complexityCount < 3) {
      return { isWeak: true, reason: 'Password lacks complexity (needs lowercase, uppercase, numbers, and/or symbols)' }
    }

    return { isWeak: false }
  }

  // JWT Token Management
  public async generateAuthToken(user: User, expiresIn: string = '24h', rememberMe?: boolean): Promise<string> {
    const payload: Omit<UserSession, 'loginAt' | 'expiresAt'> & { rememberMe?: boolean } = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      rememberMe: rememberMe // Store rememberMe flag in JWT payload
    }

    return await this.deps.cryptoAdapter.generateJWT(payload, this.deps.jwtSecret, { expiresIn })
  }

  public async verifyAuthToken(token: string): Promise<UserSession | null> {
    const decoded = await this.deps.cryptoAdapter.verifyJWT(token, this.deps.jwtSecret)

    // Handle both standard 'userId' claim and OAuth2 'sub' claim
    const userId = decoded?.userId || decoded?.sub
    const username = decoded?.username

    if (!decoded || !userId || !username) {
      return null
    }

    // Fetch fresh user data from storage to get current permissions
    try {
      const currentUser = await this.deps.getUser(userId)
      if (!currentUser || !currentUser.isActive) {
        return null // User no longer exists or is inactive
      }

      return {
        userId,
        username,
        role: currentUser.role, // Use fresh role from storage
        permissions: currentUser.permissions, // Use fresh permissions from storage
        loginAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
      }
    } catch (error) {
      // If we can't fetch user data, fall back to JWT payload for backwards compatibility
      if (!decoded.role || !decoded.permissions) {
        return null
      }

      return {
        userId,
        username,
        role: decoded.role,
        permissions: decoded.permissions,
        loginAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
      }
    }
  }

  /**
   * Unified token validation that handles both JWT and API tokens
   * Returns a consistent UserSession interface for both token types
   */
  public async verifyAnyToken(token: string): Promise<UserSession | null> {
    // Check if it's a JWT token (3 parts separated by dots)
    const parts = token.split('.')
    if (parts.length === 3) {
      // JWT token - use existing verification
      return await this.verifyAuthToken(token)
    } else if (token.length === 64 && /^[a-f0-9]{64}$/.test(token)) {
      // API token - validate and get permissions
      const result = await this.deps.validateAppToken(token)
      if (result.valid && result.appToken) {
        // Create a session-like object for API tokens
        return {
          userId: result.appToken.createdBy,
          username: `api-token-${result.appToken.name}`,
          role: 'api', // Special role for API tokens
          permissions: result.appToken.permissions,
          loginAt: new Date().toISOString(),
          expiresAt: result.appToken.expiresAt
        }
      }
    }

    return null
  }

  /**
   * Authentication result types for MFA support
   */
  public async authenticateUser(
    username: string,
    password: string,
    options: { rememberMe?: boolean; deviceId?: string } = {}
  ): Promise<AuthenticationResult | null> {
    try {
      // Get user by username
      const user = await this.deps.getUserByUsername(username)
      if (!user || !user.isActive) {
        return null
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
      if (!isPasswordValid) {
        return null
      }

      // Upgrade the stored hash if it uses an outdated format or work factor.
      // Never blocks login: any failure below is logged and ignored.
      const loginUpdate: UpdateUserData = { lastLoginAt: new Date().toISOString() }
      let loginUpdatePersisted = false
      if (this.deps.cryptoAdapter.needsRehash(user.passwordHash)) {
        try {
          const upgradedHash = await this.hashPassword(password)
          const updateUserIf = this.deps.updateUserIf
          if (updateUserIf) {
            // Atomic compare-and-set: the write only applies while the stored
            // hash is still the one we verified, so a password change/reset that
            // commits in between cannot be overwritten.
            const conditionalUpdate: Partial<UpdateUserData> = { ...loginUpdate, passwordHash: upgradedHash }
            const updated = await updateUserIf(
              user.id,
              conditionalUpdate,
              { passwordHash: user.passwordHash }
            )
            if (updated) {
              loginUpdatePersisted = true
              // Mirror the audit event updateUser would have emitted for this write
              this.deps.logAuditEvent({
                type: 'user_updated',
                targetUserId: user.id,
                username: user.username,
                action: `User updated`,
                timestamp: new Date().toISOString(),
                success: true,
                details: {
                  updatedFields: Object.keys(conditionalUpdate),
                  previousRole: user.role,
                  newRole: user.role
                }
              })
              this.deps.logger.debug('Password hash upgraded to current format', { userId: user.id })
            } else {
              this.deps.logger.debug('Skipped password hash upgrade: hash changed during login', { userId: user.id })
            }
          } else {
            // Adapter has no conditional update: guard with a re-read, which
            // narrows but does not close the race.
            const current = await this.deps.getUser(user.id)
            if (current && current.passwordHash === user.passwordHash) {
              loginUpdate.passwordHash = upgradedHash
            } else {
              this.deps.logger.debug('Skipped password hash upgrade: hash changed during login', { userId: user.id })
            }
          }
        } catch (error) {
          this.deps.logger.warn('Failed to upgrade password hash', { userId: user.id })
        }
      }

      // Persist last login time (and upgraded hash, if any) in a single write.
      // A storage failure here must not turn a correct password into a 401.
      if (!loginUpdatePersisted) {
        try {
          await this.deps.updateUser(user.id, loginUpdate)
          if (loginUpdate.passwordHash) {
            this.deps.logger.debug('Password hash upgraded to current format', { userId: user.id })
          }
        } catch (error) {
          this.deps.logger.warn('Failed to persist login update', { userId: user.id })
        }
      }

      // Check MFA requirements
      const mfaStatus = await this.deps.checkMFARequired(user.id)

      // If MFA is required
      if (mfaStatus.required) {
        // Check if device is trusted (can skip MFA)
        if (options.deviceId && mfaStatus.userHasMFA) {
          const isTrusted = await this.deps.isDeviceTrusted(user.id, options.deviceId)
          if (isTrusted) {
            // Device is trusted, issue full tokens
            return this.issueFullTokens(user, options)
          }
        }

        // User has MFA set up - require verification
        if (mfaStatus.userHasMFA) {
          // Generate MFA pending token (short-lived)
          const mfaToken = await this.generateMFAPendingToken(user, mfaStatus.methods)

          this.deps.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'MFA verification required',
            timestamp: new Date().toISOString(),
            success: true,
            details: {
              mfaRequired: true,
              methods: mfaStatus.methods
            }
          })

          return {
            type: 'mfa_required',
            requiresMFA: true,
            mfaToken,
            methods: mfaStatus.methods,
            expiresIn: 300 // 5 minutes
          }
        }

        // Org or role requires MFA but user hasn't set it up
        if (mfaStatus.reason === 'org_required' || mfaStatus.reason === 'role_required') {
          const setupToken = await this.generateMFASetupToken(user, mfaStatus.methods)

          const message = mfaStatus.reason === 'role_required'
            ? `Your role (${user.role}) requires MFA. Please set up multi-factor authentication.`
            : 'Your organization requires MFA. Please set up multi-factor authentication.'

          this.deps.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'MFA setup required',
            timestamp: new Date().toISOString(),
            success: true,
            details: {
              mfaSetupRequired: true,
              allowedMethods: mfaStatus.methods,
              reason: mfaStatus.reason
            }
          })

          return {
            type: 'mfa_setup_required',
            requiresMFASetup: true,
            setupToken,
            allowedMethods: mfaStatus.methods,
            message,
            expiresIn: 900 // 15 minutes
          }
        }
      }

      // No MFA required - issue full tokens
      return this.issueFullTokens(user, options)
    } catch (error) {
      console.error('Authentication failed:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }

  /**
   * Issue full authentication tokens after successful login (including MFA if required)
   */
  public async issueFullTokens(
    user: User,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthenticationSuccessResult> {
    const securityConfig = this.deps.config.security?.tokens
    const tokenExpiresIn = options.rememberMe
      ? (securityConfig?.rememberMeTtl || '7d')
      : (securityConfig?.accessTokenTtl || '2h')
    const refreshTokenExpiresIn = options.rememberMe
      ? '30d'
      : (securityConfig?.refreshTokenTtl || '7d')

    const token = await this.generateAuthToken(user, tokenExpiresIn, options.rememberMe)
    const refreshToken = await this.generateAuthToken(user, refreshTokenExpiresIn, options.rememberMe)

    // Log successful login
    this.deps.logAuditEvent({
      type: 'user_login',
      userId: user.id,
      username: user.username,
      action: 'User authenticated successfully',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        role: user.role,
        lastLoginAt: new Date().toISOString(),
        rememberMe: options.rememberMe
      }
    })

    // Get token expiration time
    const session = await this.verifyAuthToken(token)
    const expiresAt = session?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    // Return user without password hash
    const { passwordHash, ...safeUser } = user
    return {
      type: 'success',
      user: { ...safeUser, passwordHash: '' } as User,
      token,
      refreshToken,
      expiresAt
    }
  }

  /**
   * Generate MFA pending token (used when MFA verification is needed)
   */
  public async generateMFAPendingToken(user: User, methods: MFAMethodType[]): Promise<string> {
    const payload = {
      type: 'mfa_pending',
      userId: user.id,
      username: user.username,
      mfaMethods: methods
    }
    return this.deps.cryptoAdapter.generateJWT(payload, this.deps.jwtSecret, { expiresIn: '5m' })
  }

  /**
   * Generate MFA setup token (used when org requires MFA but user hasn't set it up)
   */
  public async generateMFASetupToken(user: User, allowedMethods: MFAMethodType[]): Promise<string> {
    const payload = {
      type: 'mfa_setup',
      userId: user.id,
      username: user.username,
      allowedMethods
    }
    return this.deps.cryptoAdapter.generateJWT(payload, this.deps.jwtSecret, { expiresIn: '15m' })
  }

  /**
   * Complete MFA verification and issue full tokens
   * Call this after verifyMFACode returns true
   */
  public async completeMFAAuthentication(
    mfaToken: string,
    options: { rememberMe?: boolean; trustDevice?: boolean; deviceId?: string; deviceName?: string } = {}
  ): Promise<AuthenticationSuccessResult | null> {
    try {
      // Verify MFA pending token
      const payload = await this.deps.cryptoAdapter.verifyJWT(mfaToken, this.deps.jwtSecret) as {
        type: string
        userId: string
        username: string
      } | null

      if (!payload || payload.type !== 'mfa_pending') {
        return null
      }

      // Get user
      const user = await this.deps.getUser(payload.userId)
      if (!user || !user.isActive) {
        return null
      }

      // Trust device if requested
      if (options.trustDevice && options.deviceId) {
        await this.deps.trustDevice(
          user.id,
          options.deviceId,
          options.deviceName || 'Unknown Device'
        )
      }

      // Issue full tokens
      return this.issueFullTokens(user, options)
    } catch (error) {
      this.deps.logger.error('MFA authentication completion failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Verify MFA setup token and return user info
   */
  public async verifyMFASetupToken(setupToken: string): Promise<{
    userId: string
    username: string
    allowedMethods: MFAMethodType[]
  } | null> {
    try {
      const payload = await this.deps.cryptoAdapter.verifyJWT(setupToken, this.deps.jwtSecret) as {
        type: string
        userId: string
        username: string
        allowedMethods: MFAMethodType[]
      } | null

      if (!payload || payload.type !== 'mfa_setup') {
        return null
      }

      return {
        userId: payload.userId,
        username: payload.username,
        allowedMethods: payload.allowedMethods
      }
    } catch {
      return null
    }
  }

  /**
   * Verify any MFA token (pending or setup) and return payload
   */
  public async verifyMFAToken(token: string): Promise<{
    type: 'mfa_pending' | 'mfa_setup'
    userId: string
    username: string
    mfaMethods?: MFAMethodType[]
    allowedMethods?: MFAMethodType[]
  } | null> {
    try {
      const payload = await this.deps.cryptoAdapter.verifyJWT(token, this.deps.jwtSecret) as {
        type: string
        userId: string
        username: string
        mfaMethods?: MFAMethodType[]
        allowedMethods?: MFAMethodType[]
      } | null

      if (!payload) {
        return null
      }

      // Validate it's an MFA token type
      if (payload.type !== 'mfa_pending' && payload.type !== 'mfa_setup') {
        return null
      }

      return {
        type: payload.type as 'mfa_pending' | 'mfa_setup',
        userId: payload.userId,
        username: payload.username,
        mfaMethods: payload.mfaMethods,
        allowedMethods: payload.allowedMethods
      }
    } catch {
      return null
    }
  }

  /**
   * Complete MFA setup and issue full authentication tokens
   * Used when a user sets up MFA during the login flow (when org requires MFA)
   */
  public async completeMFASetupAndLogin(
    setupToken: string,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthenticationSuccessResult | null> {
    try {
      // Verify MFA setup token
      const payload = await this.deps.cryptoAdapter.verifyJWT(setupToken, this.deps.jwtSecret) as {
        type: string
        userId: string
        username: string
      } | null

      if (!payload || payload.type !== 'mfa_setup') {
        return null
      }

      // Get user
      const user = await this.deps.getUser(payload.userId)
      if (!user || !user.isActive) {
        return null
      }

      // Verify user now has MFA enabled
      if (!user.mfa?.enabled || !user.mfa.methods?.some(m => m.enabled && m.verified)) {
        this.deps.logger.warn('MFA setup completion attempted but MFA not enabled', {
          userId: user.id
        })
        return null
      }

      this.deps.logger.info('MFA setup completed, issuing auth tokens', {
        userId: user.id,
        username: user.username
      })

      // Issue full tokens
      return this.issueFullTokens(user, options)
    } catch (error) {
      this.deps.logger.error('MFA setup completion failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Verify a backup code for a user
   * Returns result with remaining codes if valid
   */
  public async verifyBackupCode(userId: string, code: string): Promise<{
    valid: boolean
    remainingCodes: string[]
  }> {
    const user = await this.deps.getUser(userId)
    if (!user || !user.mfa?.backupCodes) {
      return { valid: false, remainingCodes: [] }
    }

    const totpService = this.deps.getTOTPService()
    const result = totpService.verifyBackupCode(user.mfa.backupCodes, code)

    if (result.valid) {
      // Update user with remaining codes
      await this.deps.updateUser(userId, {
        mfa: {
          ...user.mfa,
          backupCodes: result.remainingCodes
        }
      } as UpdateUserData)

      this.deps.logger.info('Backup code used', {
        userId,
        remainingCodes: result.remainingCodes.length
      })
    }

    return result
  }

  public async refreshAuthToken(refreshToken: string): Promise<{ token: string; refreshToken: string; user: User; expiresAt: string } | null> {
    try {
      // Verify the refresh token
      const session = await this.verifyAuthToken(refreshToken)
      if (!session) {
        return null
      }

      // Get the user
      const user = await this.deps.getUser(session.userId)
      if (!user || !user.isActive) {
        return null
      }

      // Extract rememberMe flag from the refresh token payload
      const decoded = await this.deps.cryptoAdapter.verifyJWT(refreshToken, this.deps.jwtSecret)
      const rememberMe = decoded?.rememberMe === true

      // Generate new tokens preserving the rememberMe state
      const securityConfig = this.deps.config.security?.tokens
      const tokenExpiresIn = rememberMe
        ? (securityConfig?.rememberMeTtl || '7d')
        : (securityConfig?.accessTokenTtl || '2h')
      const refreshTokenExpiresIn = rememberMe
        ? '30d'
        : (securityConfig?.refreshTokenTtl || '7d')

      const newToken = await this.generateAuthToken(user, tokenExpiresIn, rememberMe)
      const newRefreshToken = await this.generateAuthToken(user, refreshTokenExpiresIn, rememberMe)

      // Get the new token's expiration time
      const newSession = await this.verifyAuthToken(newToken)
      const expiresAt = newSession?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user,
        expiresAt
      }
    } catch (error) {
      this.deps.logger.error('Failed to refresh auth token', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }
}
