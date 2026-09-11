import { detectCryptoAdapter } from '../crypto/adapter.js'
import { InvalidInputError } from '../errors/index.js'
import { TOTPService, EmailOTPService, type TOTPSecretResult, type StoredEmailOTP } from '../security/mfa/index.js'
import type { TrokkyEventBus } from '../events/index.js'
import type { TrokkyLogger } from '../utils/logger.js'
import type { AuditEvent } from '../core/engine.js'
import type {
  MFAMethod,
  MFAMethodType,
  SettingsConfig,
  UpdateUserData,
  User
} from '../types/index.js'

export interface MFARequirement {
  required: boolean
  methods: MFAMethodType[]
  reason: 'user_enabled' | 'org_required' | 'role_required' | 'not_required'
  userHasMFA: boolean
}

export interface MFAServiceDependencies {
  logger: TrokkyLogger
  eventBus: TrokkyEventBus
  eventsEnabled: boolean
  getUser: (id: string) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>
  getSettings: () => Promise<SettingsConfig | null>
  verifyPassword: (plainPassword: string, hashedPassword: string) => Promise<boolean>
  logAuditEvent: (event: AuditEvent) => void
  /** Name shown in authenticator apps, resolved from config and settings. */
  getMfaIssuer: (settings?: { organizationName?: string; studioTitle?: string }) => string
}

/**
 * Generate a cryptographically secure random secret.
 * Standalone so TrokkyCore can use it before its services exist.
 */
export function generateSecureSecret(): string {
  // Generate a cryptographically secure random secret using crypto adapter
  // This will be called during initialization, but we need to create a temporary adapter
  const tempAdapter = detectCryptoAdapter()
  const secret = tempAdapter.generateSecureRandom(64)

  // Warn if using generated secret (should use environment variable in production)
  const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
  if (!isTestEnv) {
    console.warn('⚠️  Using auto-generated JWT secret. Set TROKKY_JWT_SECRET environment variable for production.')
  }

  return secret
}

/**
 * Name shown beside a TOTP enrolment in an authenticator app.
 *
 * Operators commonly run several instances under one account, so a fixed name
 * makes the entries indistinguishable. The chain prefers an explicit setting
 * but falls back to the passkey `rpName`, which most deployments already set to
 * the site's own name, so an existing install gets a useful label without
 * editing any config.
 */
export function resolveMfaIssuer(
  config: { security?: { mfa?: { issuer?: string }; passkey?: { rpName?: string } } },
  settings?: { organizationName?: string; studioTitle?: string }
): string {
  // A value of only whitespace is not a name; treat it as unset. Colons are
  // stripped because the Key Uri Format separates the issuer from the account
  // name with one, and a colon inside the issuer would give the label two
  // separators - authenticator apps split on the first and mis-read both parts.
  const usable = (candidate?: string): string | undefined => {
    const cleaned = candidate?.replace(/:/g, '').trim()
    return cleaned ? cleaned : undefined
  }

  return (
    usable(config.security?.mfa?.issuer) ||
    usable(config.security?.passkey?.rpName) ||
    usable(settings?.organizationName) ||
    usable(settings?.studioTitle) ||
    'Trokky'
  )
}

/**
 * Multi-factor authentication service: TOTP and email OTP enrolment,
 * verification, backup codes and administrative resets.
 */
export class MFAService {
  constructor(private readonly deps: MFAServiceDependencies) {}

  /**
   * Get the TOTP service instance
   * Creates one with a default issuer (can be overridden via settings)
   */
  public getTOTPService(issuer?: string): TOTPService {
    // The resolved issuer comes from config via `deps.getMfaIssuer`; the explicit
    // argument is only for callers that already know a different one.
    return new TOTPService({ issuer: issuer || this.deps.getMfaIssuer() })
  }

  /**
   * Get the Email OTP service instance
   */
  public getEmailOTPService(): EmailOTPService {
    return new EmailOTPService({
      codeLength: 6,
      expiryMinutes: 10,
      maxAttempts: 5
    })
  }

  /**
   * Check if MFA is required for a user
   * Returns whether MFA is required and available methods
   */
  public async checkMFARequired(userId: string): Promise<MFARequirement> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Check if user has MFA enabled
    const userHasMFA = user.mfa?.enabled === true && (user.mfa.methods?.length ?? 0) > 0
    const userMethods = user.mfa?.methods?.filter(m => m.enabled && m.verified).map(m => m.type) || []

    // Check organization-level MFA requirement
    const settings = await this.deps.getSettings()
    const orgRequiresMFA = settings?.mfaRequired === true

    // Check role-based MFA enforcement
    const enforcedRoles = settings?.mfaEnforcedRoles || []
    const roleRequiresMFA = user.role !== 'api' && enforcedRoles.includes(user.role as any)

    if (userHasMFA) {
      return {
        required: true,
        methods: userMethods,
        reason: 'user_enabled',
        userHasMFA: true
      }
    }

    if (orgRequiresMFA) {
      // Org requires MFA but user hasn't set it up yet
      const allowedMethods = settings?.mfaAllowedMethods || ['totp', 'email']
      return {
        required: true,
        methods: allowedMethods,
        reason: 'org_required',
        userHasMFA: false
      }
    }

    if (roleRequiresMFA) {
      // User's role requires MFA but user hasn't set it up yet
      const allowedMethods = settings?.mfaAllowedMethods || ['totp', 'email']
      return {
        required: true,
        methods: allowedMethods,
        reason: 'role_required',
        userHasMFA: false
      }
    }

    return {
      required: false,
      methods: [],
      reason: 'not_required',
      userHasMFA: false
    }
  }

  /**
   * Initialize TOTP setup for a user
   * Returns QR code and secret for authenticator app
   */
  public async initializeTOTPSetup(userId: string): Promise<TOTPSecretResult> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // This is the enrolment path, so it decides the label a user ends up seeing.
    // It previously read the Studio title first, which commonly still holds the
    // generic default and so produced the same name on every instance.
    const settings = await this.deps.getSettings()
    const totpService = this.getTOTPService(this.deps.getMfaIssuer(settings ?? undefined))
    const result = await totpService.generateSecret(user.email || user.username)

    // Store the secret temporarily in user preferences (unverified)
    const pendingTOTP: MFAMethod = {
      type: 'totp',
      enabled: false,
      verified: false,
      secret: result.secret // Will be encrypted by storage adapter
    }

    // Update user with pending TOTP setup
    const currentMFA = user.mfa || { enabled: false, methods: [] }
    const existingMethods = (currentMFA.methods || []).filter(m => m.type !== 'totp')

    await this.deps.updateUser(userId, {
      mfa: {
        ...currentMFA,
        methods: [...existingMethods, pendingTOTP]
      }
    } as UpdateUserData)

    this.deps.logger.info('TOTP setup initialized', { userId })

    return result
  }

  /**
   * Verify and enable TOTP for a user
   * Must be called after initializeTOTPSetup with a valid code from authenticator
   */
  public async verifyAndEnableTOTP(userId: string, code: string): Promise<{
    enabled: boolean
    backupCodes?: string[]
  }> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Find pending TOTP method
    const pendingTOTP = user.mfa?.methods?.find(m => m.type === 'totp' && !m.verified)
    if (!pendingTOTP || !pendingTOTP.secret) {
      throw new InvalidInputError('No pending TOTP setup found. Call initializeTOTPSetup first.', 'totp')
    }

    // Verify the code
    const totpService = this.getTOTPService()
    const isValid = totpService.verifyCode(pendingTOTP.secret, code)

    if (!isValid) {
      throw new InvalidInputError('Invalid TOTP code', 'code')
    }

    // Update TOTP method as verified and enabled
    const verifiedTOTP: MFAMethod = {
      ...pendingTOTP,
      enabled: true,
      verified: true,
      verifiedAt: new Date().toISOString()
    }

    const currentMFA = user.mfa || { enabled: false, methods: [] }
    const otherMethods = (currentMFA.methods || []).filter(m => m.type !== 'totp')

    // Generate backup codes only if this is the first MFA method
    let backupCodes: string[] | undefined
    let hashedBackupCodes = currentMFA.backupCodes
    let backupCodesGeneratedAt = currentMFA.backupCodesGeneratedAt

    if (!hashedBackupCodes || hashedBackupCodes.length === 0) {
      backupCodes = totpService.generateBackupCodes(10)
      hashedBackupCodes = backupCodes.map(c => totpService.hashBackupCode(c))
      backupCodesGeneratedAt = new Date().toISOString()
    }

    await this.deps.updateUser(userId, {
      mfa: {
        enabled: true,
        methods: [...otherMethods, verifiedTOTP],
        backupCodes: hashedBackupCodes,
        backupCodesGeneratedAt,
        trustedDevices: currentMFA.trustedDevices || []
      }
    } as UpdateUserData)

    this.deps.logger.info('TOTP enabled for user', { userId })

    // Log audit event
    this.deps.logAuditEvent({
      type: 'user_updated',
      userId,
      username: user.username,
      action: 'MFA TOTP enabled',
      timestamp: new Date().toISOString(),
      success: true,
      details: { mfaMethod: 'totp' }
    })

    return {
      enabled: true,
      backupCodes // Return plain codes - user must save them
    }
  }

  /**
   * Initialize Email OTP setup for a user
   * Sends verification code to user's email
   */
  public async initializeEmailOTPSetup(userId: string): Promise<{ expiresIn: number }> {
    const user = await this.deps.getUser(userId)
    if (!user || !user.email) {
      throw new InvalidInputError('User not found or has no email', 'userId')
    }

    const emailService = this.getEmailOTPService()
    const result = emailService.generateCode()

    // Store the OTP in user preferences
    const storedOTP: StoredEmailOTP = emailService.createStoredOTP(result)

    // Store in user preferences for later verification
    const currentPreferences = user.preferences || {}
    await this.deps.updateUser(userId, {
      preferences: {
        ...currentPreferences,
        _pendingEmailOTP: storedOTP
      }
    } as UpdateUserData)

    // Emit event for email notification
    if (this.deps.eventsEnabled) {
      this.deps.eventBus.emitEvent({
        type: 'user.mfa_otp_requested',
        source: 'trokky-core',
        data: {
          userId,
          email: user.email,
          firstName: user.firstName,
          otpCode: result.code,
          expiryMinutes: 10,
          purpose: 'MFA setup',
        },
      }).catch(error => {
        this.deps.logger.warn('Failed to emit MFA OTP event', error)
      })
    }

    this.deps.logger.info('Email OTP generated for MFA setup', {
      userId,
      email: user.email,
      expiresAt: result.expiresAt
    })

    return { expiresIn: 10 * 60 } // 10 minutes in seconds
  }

  /**
   * Verify and enable Email OTP for a user
   */
  public async verifyAndEnableEmailOTP(userId: string, code: string): Promise<{
    enabled: boolean
    backupCodes?: string[]
  }> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Get stored OTP from preferences
    const storedOTP = user.preferences?._pendingEmailOTP as StoredEmailOTP | undefined
    if (!storedOTP) {
      throw new InvalidInputError('No pending email OTP found. Call initializeEmailOTPSetup first.', 'emailOtp')
    }

    // Verify the code
    const emailService = this.getEmailOTPService()
    const verificationResult = emailService.verifyCode(code, storedOTP)

    if (!verificationResult.valid) {
      if (verificationResult.expired) {
        throw new InvalidInputError('Email OTP has expired', 'code')
      }
      if (verificationResult.maxAttemptsExceeded) {
        throw new InvalidInputError('Maximum verification attempts exceeded', 'code')
      }

      // Update attempt count
      const updatedOTP = emailService.incrementAttempts(storedOTP)
      await this.deps.updateUser(userId, {
        preferences: {
          ...user.preferences,
          _pendingEmailOTP: updatedOTP
        }
      } as UpdateUserData)

      throw new InvalidInputError(
        `Invalid code. ${verificationResult.attemptsRemaining} attempts remaining.`,
        'code'
      )
    }

    // Create verified email MFA method
    const emailMethod: MFAMethod = {
      type: 'email',
      enabled: true,
      verified: true,
      verifiedAt: new Date().toISOString()
    }

    const currentMFA = user.mfa || { enabled: false, methods: [] }
    const otherMethods = (currentMFA.methods || []).filter(m => m.type !== 'email')

    // Generate backup codes if this is the first MFA method
    let backupCodes: string[] | undefined
    let hashedBackupCodes = currentMFA.backupCodes
    let backupCodesGeneratedAt = currentMFA.backupCodesGeneratedAt

    if (!hashedBackupCodes || hashedBackupCodes.length === 0) {
      const totpService = this.getTOTPService()
      backupCodes = totpService.generateBackupCodes(10)
      hashedBackupCodes = backupCodes.map(c => totpService.hashBackupCode(c))
      backupCodesGeneratedAt = new Date().toISOString()
    }

    // Remove pending OTP and update MFA config
    const { _pendingEmailOTP, ...cleanPreferences } = user.preferences || {}

    await this.deps.updateUser(userId, {
      preferences: cleanPreferences,
      mfa: {
        enabled: true,
        methods: [...otherMethods, emailMethod],
        backupCodes: hashedBackupCodes,
        backupCodesGeneratedAt,
        trustedDevices: currentMFA.trustedDevices || []
      }
    } as UpdateUserData)

    this.deps.logger.info('Email OTP enabled for user', { userId })

    return { enabled: true, backupCodes }
  }

  /**
   * Verify MFA code during login
   * Supports TOTP, email, and backup codes
   */
  public async verifyMFACode(
    userId: string,
    code: string,
    method: 'totp' | 'email' | 'backup'
  ): Promise<boolean> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    if (method === 'totp') {
      const totpMethod = user.mfa?.methods?.find(m => m.type === 'totp' && m.enabled && m.verified)
      if (!totpMethod?.secret) {
        throw new InvalidInputError('TOTP not configured for this user', 'method')
      }

      const totpService = this.getTOTPService()
      return totpService.verifyCode(totpMethod.secret, code)
    }

    if (method === 'backup') {
      const hashedCodes = user.mfa?.backupCodes || []
      if (hashedCodes.length === 0) {
        throw new InvalidInputError('No backup codes available', 'method')
      }

      const totpService = this.getTOTPService()
      const result = totpService.verifyBackupCode(hashedCodes, code)

      if (result.valid) {
        // Update user with remaining backup codes
        await this.deps.updateUser(userId, {
          mfa: {
            ...user.mfa!,
            backupCodes: result.remainingCodes
          }
        } as UpdateUserData)

        this.deps.logger.info('Backup code used', {
          userId,
          remainingCodes: result.remainingCodes.length
        })
      }

      return result.valid
    }

    if (method === 'email') {
      // Email OTP verification during login
      const storedOTP = user.preferences?._loginEmailOTP as StoredEmailOTP | undefined
      if (!storedOTP) {
        throw new InvalidInputError('No email OTP sent. Call sendMFAEmailOTP first.', 'method')
      }

      const emailService = this.getEmailOTPService()
      const result = emailService.verifyCode(code, storedOTP)

      if (result.valid) {
        // Clear the OTP
        const { _loginEmailOTP, ...cleanPreferences } = user.preferences || {}
        await this.deps.updateUser(userId, {
          preferences: cleanPreferences
        } as UpdateUserData)
      } else if (!result.expired && !result.maxAttemptsExceeded) {
        // Update attempt count
        const updatedOTP = emailService.incrementAttempts(storedOTP)
        await this.deps.updateUser(userId, {
          preferences: {
            ...user.preferences,
            _loginEmailOTP: updatedOTP
          }
        } as UpdateUserData)
      }

      return result.valid
    }

    return false
  }

  /**
   * Send Email OTP for MFA verification during login
   */
  public async sendMFAEmailOTP(userId: string): Promise<{ expiresIn: number }> {
    const user = await this.deps.getUser(userId)
    if (!user || !user.email) {
      throw new InvalidInputError('User not found or has no email', 'userId')
    }

    // Check if email MFA is enabled for this user
    const emailMethod = user.mfa?.methods?.find(m => m.type === 'email' && m.enabled && m.verified)
    if (!emailMethod) {
      throw new InvalidInputError('Email MFA not enabled for this user', 'method')
    }

    const emailService = this.getEmailOTPService()
    const result = emailService.generateCode()
    const storedOTP = emailService.createStoredOTP(result)

    // Store for verification
    await this.deps.updateUser(userId, {
      preferences: {
        ...user.preferences,
        _loginEmailOTP: storedOTP
      }
    } as UpdateUserData)

    // Emit event for email notification
    if (this.deps.eventsEnabled) {
      this.deps.eventBus.emitEvent({
        type: 'user.mfa_otp_requested',
        source: 'trokky-core',
        data: {
          userId,
          email: user.email,
          firstName: user.firstName,
          otpCode: result.code,
          expiryMinutes: 10,
          purpose: 'login verification',
        },
      }).catch(error => {
        this.deps.logger.warn('Failed to emit MFA OTP event', error)
      })
    }

    this.deps.logger.info('Login email OTP generated', {
      userId,
      email: user.email,
      expiresAt: result.expiresAt
    })

    return { expiresIn: 10 * 60 }
  }

  /**
   * Disable MFA method for a user
   * Requires password verification
   */
  public async disableMFAMethod(
    userId: string,
    method: MFAMethodType,
    password: string
  ): Promise<void> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Verify password
    const isPasswordValid = await this.deps.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new InvalidInputError('Invalid password', 'password')
    }

    // Check if this is the last MFA method
    const enabledMethods = user.mfa?.methods?.filter(m => m.enabled && m.verified) || []
    if (enabledMethods.length <= 1 && enabledMethods[0]?.type === method) {
      // Check if org requires MFA
      const settings = await this.deps.getSettings()
      if (settings?.mfaRequired) {
        throw new InvalidInputError(
          'Cannot disable last MFA method when organization requires MFA',
          'method'
        )
      }
    }

    // Remove the method
    const updatedMethods = (user.mfa?.methods || []).filter(m => m.type !== method)
    const stillHasMFA = updatedMethods.some(m => m.enabled && m.verified)

    await this.deps.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        enabled: stillHasMFA,
        methods: updatedMethods
      }
    } as UpdateUserData)

    this.deps.logger.info('MFA method disabled', { userId, method })

    this.deps.logAuditEvent({
      type: 'user_updated',
      userId,
      username: user.username,
      action: `MFA ${method} disabled`,
      timestamp: new Date().toISOString(),
      success: true,
      details: { mfaMethod: method }
    })
  }

  /**
   * Disable all MFA for a user (removes all methods and backup codes)
   * Requires password verification
   */
  public async disableAllMFA(userId: string, password: string): Promise<void> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Verify password
    const isPasswordValid = await this.deps.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new InvalidInputError('Invalid password', 'password')
    }

    // Check if org requires MFA
    const settings = await this.deps.getSettings()
    if (settings?.mfaRequired) {
      throw new InvalidInputError(
        'Cannot disable MFA when organization requires MFA',
        'mfa'
      )
    }

    // Completely reset MFA
    await this.deps.updateUser(userId, {
      mfa: {
        enabled: false,
        methods: [],
        backupCodes: [],
        backupCodesGeneratedAt: undefined,
        trustedDevices: []
      }
    } as UpdateUserData)

    this.deps.logger.info('All MFA disabled for user', { userId })

    this.deps.logAuditEvent({
      type: 'user_updated',
      userId,
      username: user.username,
      action: 'All MFA disabled',
      timestamp: new Date().toISOString(),
      success: true,
      details: { mfaDisabled: true }
    })
  }

  /**
   * Regenerate backup codes for a user
   * Requires password verification
   */
  public async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Verify password
    const isPasswordValid = await this.deps.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new InvalidInputError('Invalid password', 'password')
    }

    // Check if user has MFA enabled
    if (!user.mfa?.enabled) {
      throw new InvalidInputError('MFA is not enabled', 'mfa')
    }

    const totpService = this.getTOTPService()
    const backupCodes = totpService.generateBackupCodes(10)
    const hashedBackupCodes = backupCodes.map(c => totpService.hashBackupCode(c))

    await this.deps.updateUser(userId, {
      mfa: {
        ...user.mfa,
        backupCodes: hashedBackupCodes,
        backupCodesGeneratedAt: new Date().toISOString()
      }
    } as UpdateUserData)

    this.deps.logger.info('Backup codes regenerated', { userId })

    return backupCodes
  }

  /**
   * Admin: Reset MFA for a user (emergency recovery)
   * Removes all MFA configuration
   */
  public async adminResetUserMFA(adminUserId: string, targetUserId: string): Promise<void> {
    // Verify admin has permission
    const admin = await this.deps.getUser(adminUserId)
    if (!admin || admin.role !== 'admin') {
      throw new InvalidInputError('Unauthorized: Admin access required', 'adminUserId')
    }

    const targetUser = await this.deps.getUser(targetUserId)
    if (!targetUser) {
      throw new InvalidInputError('Target user not found', 'targetUserId')
    }

    // Reset MFA configuration
    await this.deps.updateUser(targetUserId, {
      mfa: {
        enabled: false,
        methods: [],
        backupCodes: [],
        trustedDevices: []
      }
    } as UpdateUserData)

    this.deps.logger.warn('Admin reset MFA for user', {
      adminUserId,
      adminUsername: admin.username,
      targetUserId,
      targetUsername: targetUser.username
    })

    this.deps.logAuditEvent({
      type: 'admin_access',
      userId: adminUserId,
      targetUserId,
      username: admin.username,
      action: 'Admin reset MFA for user',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        targetUsername: targetUser.username
      }
    })
  }

  /**
   * Get MFA status for a user
   */
  public async getMFAStatus(userId: string): Promise<{
    enabled: boolean
    methods: Array<{ type: MFAMethodType; enabled: boolean; verified: boolean; verifiedAt?: string }>
    backupCodesRemaining: number
    backupCodesGeneratedAt?: string
    trustedDevicesCount: number
  }> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    const mfa = user.mfa || { enabled: false, methods: [] }

    return {
      enabled: mfa.enabled,
      methods: (mfa.methods || []).map(m => ({
        type: m.type,
        enabled: m.enabled,
        verified: m.verified,
        verifiedAt: m.verifiedAt
      })),
      backupCodesRemaining: (mfa.backupCodes || []).length,
      backupCodesGeneratedAt: mfa.backupCodesGeneratedAt,
      trustedDevicesCount: (mfa.trustedDevices || []).filter(
        d => new Date(d.expiresAt) > new Date()
      ).length
    }
  }

  public generateSecureSecret(): string {
    return generateSecureSecret()
  }
}
