import { InvalidInputError } from '../errors/index.js'
import type { TrokkyLogger } from '../utils/logger.js'
import type { AuditEvent } from '../core/engine.js'
import type { MFARequirement } from './mfa-service.js'
import type {
  AuthenticationResult,
  AuthenticationSuccessResult,
  DataStorageAdapter,
  MFAMethodType,
  TrokkyConfig,
  UpdateUserData,
  User,
  UserListOptions
} from '../types/index.js'

export interface PasskeyServiceDependencies {
  config: TrokkyConfig
  logger: TrokkyLogger
  dataStorage: DataStorageAdapter
  getUser: (id: string) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>
  listUsers: (options?: UserListOptions) => Promise<User[]>
  logAuditEvent: (event: AuditEvent) => void
  checkMFARequired: (userId: string) => Promise<MFARequirement>
  isDeviceTrusted: (userId: string, deviceId: string) => Promise<boolean>
  issueFullTokens: (user: User, options?: { rememberMe?: boolean }) => Promise<AuthenticationSuccessResult>
  generateMFAPendingToken: (user: User, methods: MFAMethodType[]) => Promise<string>
  generateMFASetupToken: (user: User, allowedMethods: MFAMethodType[]) => Promise<string>
}

/**
 * Passkey/WebAuthn credential management and login.
 */
export class PasskeyService {
  constructor(private readonly deps: PasskeyServiceDependencies) {}

  /**
   * Check if passkey authentication is configured
   */
  public isPasskeyConfigured(): boolean {
    const config = this.deps.config.security?.passkey
    // Debug logging
    this.deps.logger.debug('isPasskeyConfigured check', {
      hasSecurityConfig: !!this.deps.config.security,
      hasPasskeyConfig: !!config,
      passkeyEnabled: config?.enabled,
      passkeyRpId: config?.rpId,
      passkeyOrigin: config?.origin,
    })
    return !!(config?.enabled && config?.rpId && config?.origin)
  }

  /**
   * Get passkey configuration
   */
  public getPasskeyConfig(): import('../../types/index.js').PasskeyConfig | null {
    if (!this.isPasskeyConfigured()) return null
    return this.deps.config.security!.passkey!
  }

  /**
   * Find a user by passkey credential ID
   */
  public async getUserByPasskeyCredentialId(credentialId: string): Promise<User | null> {
    // First try storage adapter method if available
    if ((this.deps.dataStorage as any).getUserByPasskeyCredentialId) {
      return (this.deps.dataStorage as any).getUserByPasskeyCredentialId(credentialId)
    }

    // Fallback: list all users and search (inefficient, but works as fallback)
    this.deps.logger.warn(
      'getUserByPasskeyCredentialId not implemented in storage adapter, using fallback'
    )
    const users = await this.deps.listUsers({ limit: 10000 })
    for (const user of users) {
      const credential = (user.passkeys || []).find(
        (p) => p.id === credentialId
      )
      if (credential) {
        return user
      }
    }
    return null
  }

  /**
   * Add a passkey credential to a user
   */
  public async addPasskeyToUser(
    userId: string,
    credential: import('../../types/index.js').PasskeyCredential
  ): Promise<User> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    // Check if credential ID already exists for this user
    const existingPasskeys = user.passkeys || []
    const alreadyExists = existingPasskeys.some((p) => p.id === credential.id)
    if (alreadyExists) {
      throw new InvalidInputError('Passkey credential already registered')
    }

    // Add the credential
    const updatedPasskeys = [...existingPasskeys, credential]
    const updatedUser = await this.deps.updateUser(userId, {
      passkeys: updatedPasskeys,
    } as any)

    this.deps.logAuditEvent({
      type: 'user_updated',
      targetUserId: userId,
      username: user.username,
      action: 'Passkey credential added',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        credentialId: credential.id,
        friendlyName: credential.friendlyName,
        deviceType: credential.deviceType,
      },
    })

    return updatedUser
  }

  /**
   * Remove a passkey credential from a user
   */
  public async removePasskeyFromUser(userId: string, credentialId: string): Promise<User> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    const existingPasskeys = user.passkeys || []
    const credentialToRemove = existingPasskeys.find((p) => p.id === credentialId)

    if (!credentialToRemove) {
      throw new InvalidInputError('Passkey credential not found')
    }

    const updatedPasskeys = existingPasskeys.filter((p) => p.id !== credentialId)
    const updatedUser = await this.deps.updateUser(userId, {
      passkeys: updatedPasskeys,
    } as any)

    this.deps.logAuditEvent({
      type: 'user_updated',
      targetUserId: userId,
      username: user.username,
      action: 'Passkey credential removed',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        credentialId,
        friendlyName: credentialToRemove.friendlyName,
      },
    })

    return updatedUser
  }

  /**
   * Update a passkey credential (counter, lastUsedAt, friendlyName)
   */
  public async updateUserPasskey(
    userId: string,
    credentialId: string,
    updates: Partial<import('../../types/index.js').PasskeyCredential>
  ): Promise<User> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    const existingPasskeys = user.passkeys || []
    const credentialIndex = existingPasskeys.findIndex((p) => p.id === credentialId)

    if (credentialIndex === -1) {
      throw new InvalidInputError('Passkey credential not found')
    }

    // Update the credential
    const updatedCredential = {
      ...existingPasskeys[credentialIndex],
      ...updates,
    }
    const updatedPasskeys = [...existingPasskeys]
    updatedPasskeys[credentialIndex] = updatedCredential

    const updatedUser = await this.deps.updateUser(userId, {
      passkeys: updatedPasskeys,
    } as any)

    return updatedUser
  }

  /**
   * Authenticate with passkey (after WebAuthn verification)
   * Similar to authenticateWithOAuth but for passkeys
   */
  public async authenticateWithPasskey(
    userId: string,
    credentialId: string,
    options?: { deviceId?: string }
  ): Promise<AuthenticationResult | null> {
    try {
      const user = await this.deps.getUser(userId)
      if (!user || !user.isActive) {
        return null
      }

      // Update last login time and lastUsedAt for the passkey
      const now = new Date().toISOString()
      const updatedPasskeys = (user.passkeys || []).map((p) =>
        p.id === credentialId ? { ...p, lastUsedAt: now } : p
      )

      await this.deps.updateUser(user.id, {
        lastLoginAt: now,
        passkeys: updatedPasskeys,
      } as any)

      // Check MFA requirements (same as regular login)
      const mfaStatus = await this.deps.checkMFARequired(user.id)

      if (mfaStatus.required) {
        // User has MFA set up - check if device is trusted first
        if (mfaStatus.userHasMFA) {
          // Check if device is trusted (can skip MFA)
          if (options?.deviceId) {
            const isTrusted = await this.deps.isDeviceTrusted(user.id, options.deviceId)
            if (isTrusted) {
              this.deps.logger.info('Passkey login - skipping MFA for trusted device', {
                userId: user.id,
                credentialId: credentialId.substring(0, 8) + '...',
                deviceId: options.deviceId.substring(0, 8) + '...',
              })
              // Device is trusted, issue full tokens (skip MFA)
              return this.deps.issueFullTokens(user, {})
            }
          }

          const mfaToken = await this.deps.generateMFAPendingToken(user, mfaStatus.methods)

          this.deps.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'Passkey login - MFA verification required',
            timestamp: now,
            success: true,
            details: {
              mfaRequired: true,
              methods: mfaStatus.methods,
              authMethod: 'passkey',
            },
          })

          return {
            type: 'mfa_required',
            requiresMFA: true,
            mfaToken,
            methods: mfaStatus.methods,
            expiresIn: 300, // 5 minutes
          }
        }

        // Org/role requires MFA but user hasn't set it up
        if (mfaStatus.reason === 'org_required' || mfaStatus.reason === 'role_required') {
          const setupToken = await this.deps.generateMFASetupToken(user, mfaStatus.methods)

          const message = mfaStatus.reason === 'role_required'
            ? `Your role (${user.role}) requires MFA. Please set up multi-factor authentication.`
            : 'Your organization requires MFA. Please set up multi-factor authentication.'

          this.deps.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'Passkey login - MFA setup required',
            timestamp: now,
            success: true,
            details: {
              mfaSetupRequired: true,
              allowedMethods: mfaStatus.methods,
              reason: mfaStatus.reason,
              authMethod: 'passkey',
            },
          })

          return {
            type: 'mfa_setup_required',
            requiresMFASetup: true,
            setupToken,
            allowedMethods: mfaStatus.methods,
            message,
            expiresIn: 900, // 15 minutes
          }
        }
      }

      // No MFA required - issue full tokens
      return this.deps.issueFullTokens(user, {})
    } catch (error) {
      this.deps.logger.error('Passkey authentication failed', error)
      return null
    }
  }
}
