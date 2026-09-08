import { InvalidInputError } from '../errors/index.js'
import type { TrokkyLogger } from '../utils/logger.js'
import type { AuditEvent } from '../core/engine.js'
import type { MFARequirement } from './mfa-service.js'
import type {
  AuthenticationResult,
  AuthenticationSuccessResult,
  DataStorageAdapter,
  MFAMethodType,
  OAuthProvider,
  OAuthProviderType,
  TrokkyConfig,
  UpdateUserData,
  User,
  UserListOptions,
  UserSession
} from '../types/index.js'

export interface OAuthServiceDependencies {
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
  generateAuthToken: (user: User, expiresIn?: string, rememberMe?: boolean) => Promise<string>
  verifyAuthToken: (token: string) => Promise<UserSession | null>
}

/**
 * OAuth provider linking and login.
 */
export class OAuthService {
  constructor(private readonly deps: OAuthServiceDependencies) {}

  /**
   * Link an OAuth provider to an existing user
   */
  public async linkOAuthProvider(
    userId: string,
    provider: OAuthProvider
  ): Promise<User> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    // Check if this provider is already linked to another user
    const existingUser = await this.getUserByOAuthProvider(
      provider.provider,
      provider.providerId
    )
    if (existingUser && existingUser.id !== userId) {
      throw new InvalidInputError(
        'This account is already linked to another user'
      )
    }

    // Check if user already has this provider linked
    const existingProviders = user.oauthProviders || []
    const alreadyLinked = existingProviders.some(
      (p) => p.provider === provider.provider
    )
    if (alreadyLinked) {
      throw new InvalidInputError(
        `${provider.provider} account is already linked`
      )
    }

    // Add the provider
    const updatedProviders = [...existingProviders, provider]
    const updatedUser = await this.deps.updateUser(userId, {
      oauthProviders: updatedProviders,
    } as any)

    this.deps.logAuditEvent({
      type: 'user_updated',
      userId: user.id,
      username: user.username,
      action: `Linked ${provider.provider} OAuth account`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        provider: provider.provider,
        providerEmail: provider.email,
      },
    })

    return updatedUser
  }

  /**
   * Unlink an OAuth provider from a user
   */
  public async unlinkOAuthProvider(
    userId: string,
    providerName: OAuthProviderType
  ): Promise<User> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    const existingProviders = user.oauthProviders || []
    const providerToRemove = existingProviders.find(
      (p) => p.provider === providerName
    )

    if (!providerToRemove) {
      throw new InvalidInputError(`${providerName} account is not linked`)
    }

    // Remove the provider
    const updatedProviders = existingProviders.filter(
      (p) => p.provider !== providerName
    )
    const updatedUser = await this.deps.updateUser(userId, {
      oauthProviders: updatedProviders,
    } as any)

    this.deps.logAuditEvent({
      type: 'user_updated',
      userId: user.id,
      username: user.username,
      action: `Unlinked ${providerName} OAuth account`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        provider: providerName,
      },
    })

    return updatedUser
  }

  /**
   * Authenticate a user via OAuth provider
   * Returns null if no user is linked to this provider
   * Returns AuthenticationResult which may require MFA verification or setup
   */
  public async authenticateWithOAuth(
    providerName: OAuthProviderType,
    providerId: string,
    options?: { deviceId?: string }
  ): Promise<AuthenticationResult | null> {
    try {
      // Find user by OAuth provider
      const user = await this.getUserByOAuthProvider(providerName, providerId)
      if (!user || !user.isActive) {
        return null
      }

      // Update last login time and lastUsedAt for the OAuth provider
      const now = new Date().toISOString()
      const updatedProviders = (user.oauthProviders || []).map((p) =>
        p.provider === providerName && p.providerId === providerId
          ? { ...p, lastUsedAt: now }
          : p
      )

      await this.deps.updateUser(user.id, {
        lastLoginAt: now,
        oauthProviders: updatedProviders,
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
              this.deps.logger.info('OAuth login - skipping MFA for trusted device', {
                userId: user.id,
                provider: providerName,
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
            action: `OAuth login - MFA verification required`,
            timestamp: now,
            success: true,
            details: {
              mfaRequired: true,
              methods: mfaStatus.methods,
              provider: providerName,
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
            action: `OAuth login - MFA setup required`,
            timestamp: now,
            success: true,
            details: {
              mfaSetupRequired: true,
              allowedMethods: mfaStatus.methods,
              reason: mfaStatus.reason,
              provider: providerName,
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

      // No MFA required - generate full tokens
      const securityConfig = this.deps.config.security?.tokens
      const tokenExpiresIn = securityConfig?.accessTokenTtl || '2h'
      const refreshTokenExpiresIn = securityConfig?.refreshTokenTtl || '7d'

      const token = await this.deps.generateAuthToken(user, tokenExpiresIn, false)
      const refreshToken = await this.deps.generateAuthToken(
        user,
        refreshTokenExpiresIn,
        false
      )

      // Log successful login
      this.deps.logAuditEvent({
        type: 'user_login',
        userId: user.id,
        username: user.username,
        action: `User authenticated via ${providerName} OAuth`,
        timestamp: now,
        success: true,
        details: {
          role: user.role,
          provider: providerName,
        },
      })

      // Return user without password hash
      const { passwordHash, ...safeUser } = user

      // Get token expiration time
      const session = await this.deps.verifyAuthToken(token)

      return {
        type: 'success',
        user: { ...safeUser, passwordHash: '' } as User,
        token,
        refreshToken,
        expiresAt: session?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      this.deps.logger.error('OAuth authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: providerName,
      })
      return null
    }
  }

  /**
   * Find a user by OAuth provider
   */
  public async getUserByOAuthProvider(
    providerName: OAuthProviderType,
    providerId: string
  ): Promise<User | null> {
    // First try storage adapter method if available
    if (this.deps.dataStorage.getUserByOAuthProvider) {
      return this.deps.dataStorage.getUserByOAuthProvider(providerName, providerId)
    }

    // Fallback: list all users and search (inefficient, but works as fallback)
    this.deps.logger.warn(
      'getUserByOAuthProvider not implemented in storage adapter, using fallback'
    )
    const users = await this.deps.listUsers({ limit: 10000 })
    for (const user of users) {
      const provider = (user.oauthProviders || []).find(
        (p) => p.provider === providerName && p.providerId === providerId
      )
      if (provider) {
        return user
      }
    }
    return null
  }

  /**
   * Check if OAuth is configured for a provider
   */
  public isOAuthConfigured(providerName: OAuthProviderType): boolean {
    if (providerName === 'google') {
      const config = this.deps.config.oauth?.google
      return !!(config?.clientId && config?.clientSecret && config?.redirectUri)
    }
    return false
  }

  /**
   * Get OAuth configuration for a provider
   */
  public getOAuthConfig(providerName: OAuthProviderType): Record<string, string> | null {
    if (providerName === 'google' && this.isOAuthConfigured('google')) {
      const config = this.deps.config.oauth!.google!
      return {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      }
    }
    return null
  }
}
