import { SecurityValidator } from '../security/validation.js'
import { RateLimiter } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import type { TrokkyLogger } from '../utils/logger.js'
import { TrokkyEventBus } from '../events/index.js'
import { DocumentNotFoundError, InvalidInputError } from '../errors/index.js'
import type { AuditEvent } from '../core/engine.js'
import {
  DataStorageAdapter,
  User,
  CreateUserData,
  UpdateUserData,
  UserListOptions,
  Permission
} from '../types/index.js'

export interface UserServiceDependencies {
  logger: TrokkyLogger
  dataStorage: DataStorageAdapter
  idGenerator: IdGenerator
  rateLimiter?: RateLimiter
  securityEnabled: boolean
  eventBus: TrokkyEventBus
  hashPassword: (password: string) => Promise<string>
  checkWeakPassword: (password: string) => { isWeak: boolean; reason?: string }
  logAuditEvent: (event: AuditEvent) => void
  getUserCreatedWithPasswordCallback: () => ((user: User, temporaryPassword: string) => Promise<void>) | undefined
  /** The configured claim secret, if any. Read lazily so a Worker can supply it per request. */
  claimSecret?: () => string | undefined
}

/** Whether an instance can still be claimed, and what a claim would have to present. */
export interface ClaimStatus {
  claimable: boolean
  /** Why not, when it cannot be claimed. */
  reason?: 'already-claimed' | 'unsupported'
  /** True when a claim secret is configured and must be presented. */
  secretRequired: boolean
}

/** The first administrator, as supplied by whoever is claiming the instance. */
export interface ClaimInput {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  /** Required when the instance was deployed with a claim secret. */
  secret?: string
}

/**
 * User management operations (system entities) and env-based admin bootstrap.
 */
export class UserService {
  constructor(private readonly deps: UserServiceDependencies) {}

  // User management operations (system entities)
  public async createUser(userData: CreateUserData): Promise<User> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('createUser')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateEmail(userData.email)
      SecurityValidator.validateUsername(userData.username)
    }

    // User operations are handled by data storage adapter

    // Check if user already exists (use generic error message to prevent enumeration)
    const existingUserByEmail = await this.getUserByEmail(userData.email)
    if (existingUserByEmail) {
      throw new Error('User registration failed. Please check your details.')
    }

    const existingUserByUsername = await this.getUserByUsername(userData.username)
    if (existingUserByUsername) {
      throw new Error('User registration failed. Please check your details.')
    }

    // Hash password before saving
    const passwordHash = await this.deps.hashPassword(userData.password)

    const userId = this.deps.idGenerator.generate({ prefix: 'user' })
    const now = new Date().toISOString()

    const userToSave: Partial<User> = {
      username: userData.username,
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      permissions: userData.permissions || this.getDefaultPermissions(userData.role),
      isActive: userData.isActive ?? true,
      profileImage: userData.profileImage,
      preferences: userData.preferences || {},
      createdAt: now,
      updatedAt: now
    }

    const createdUser = await this.deps.dataStorage.saveUser(userId, userToSave)

    // Log audit event
    this.deps.logAuditEvent({
      type: 'user_created',
      targetUserId: userId,
      username: userData.username,
      action: `User created with role: ${userData.role}`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        email: userData.email,
        role: userData.role,
        permissions: userData.permissions || this.getDefaultPermissions(userData.role)
      }
    })

    // Emit user.created event (WITHOUT password for security)
    await this.deps.eventBus.emitEvent({
      type: 'user.created',
      source: 'api',
      data: {
        user: createdUser,
        userId: createdUser.id,
      },
    })

    // Securely send password via callback (not logged in events)
    const userCreatedWithPasswordCallback = this.deps.getUserCreatedWithPasswordCallback()
    if (userCreatedWithPasswordCallback) {
      try {
        await userCreatedWithPasswordCallback(createdUser, userData.password)
      } catch (error) {
        this.deps.logger.warn('User created callback failed (non-blocking)', error)
      }
    }

    return createdUser
  }

  public async getUser(id: string): Promise<User | null> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getUser')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // User operations are handled by data storage adapter
    return await this.deps.dataStorage.getUser(id)
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getUserByUsername')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateUsername(username)
    }

    // User operations are handled by data storage adapter
    return await this.deps.dataStorage.getUserByUsername(username)
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getUserByEmail')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateEmail(email)
    }

    // User operations are handled by data storage adapter
    return await this.deps.dataStorage.getUserByEmail(email)
  }

  public async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('updateUser')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
      if (userData.email) SecurityValidator.validateEmail(userData.email)
      if (userData.username) SecurityValidator.validateUsername(userData.username)
    }

    // User operations are handled by data storage adapter

    const existingUser = await this.getUser(id)
    if (!existingUser) {
      throw new DocumentNotFoundError('users', id)
    }

    const updatedUserData: Partial<User> = {
      ...userData,
      updatedAt: new Date().toISOString()
    }

    const updatedUser = await this.deps.dataStorage.saveUser(id, updatedUserData)

    // Log audit event
    this.deps.logAuditEvent({
      type: 'user_updated',
      targetUserId: id,
      username: existingUser.username,
      action: `User updated`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        updatedFields: Object.keys(userData),
        previousRole: existingUser.role,
        newRole: userData.role || existingUser.role
      }
    })

    return updatedUser
  }

  public async listUsers(options?: UserListOptions): Promise<User[]> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('listUsers')
    }

    // User operations are handled by data storage adapter
    return await this.deps.dataStorage.listUsers(options)
  }

  public async deleteUser(id: string): Promise<void> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('deleteUser')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // User operations are handled by data storage adapter

    const existingUser = await this.getUser(id)
    if (!existingUser) {
      throw new DocumentNotFoundError('users', id)
    }

    await this.deps.dataStorage.deleteUser(id)

    // Log audit event
    this.deps.logAuditEvent({
      type: 'user_deleted',
      targetUserId: id,
      username: existingUser.username,
      action: `User deleted`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        email: existingUser.email,
        role: existingUser.role
      }
    })
  }

  public getDefaultPermissions(role: string): Permission[] {
    switch (role) {
      case 'admin':
        return ['content:read', 'content:write', 'content:delete', 'users:read', 'users:write', 'settings:read', 'settings:write', 'media:upload', 'media:delete', 'studio:access']
      case 'editor':
        return ['content:read', 'content:write', 'media:upload', 'studio:access']
      case 'viewer':
        return ['content:read', 'studio:access']
      default:
        return ['content:read', 'studio:access']
    }
  }


  // ==========================================================================
  // FIRST-BOOT CLAIM
  // ==========================================================================

  /**
   * Whether this instance still has no owner, and what it would take to claim it.
   *
   * An instance with zero users has no way in: there is nobody to sign in as. The claim flow is
   * how the first administrator is created without baking a password into the deployment — which
   * is what a one-click deploy would otherwise force, and would mean every Trokky on the internet
   * sharing one default credential.
   */
  public async getClaimStatus(): Promise<ClaimStatus> {
    let userCount: number
    try {
      userCount = (await this.listUsers({ limit: 1 })).length
    } catch (error) {
      // An adapter with no user support cannot be claimed, and cannot be signed into either.
      if (error instanceof Error && error.message.includes('not supported by storage adapter')) {
        return { claimable: false, reason: 'unsupported', secretRequired: false }
      }
      throw error
    }

    if (userCount > 0) {
      return { claimable: false, reason: 'already-claimed', secretRequired: false }
    }

    return { claimable: true, secretRequired: Boolean(this.deps.claimSecret?.()) }
  }

  /**
   * Create the first administrator, claiming an instance that has none.
   *
   * Two things guard it. The instance must have no users at all — so this closes permanently the
   * moment it succeeds. And when a claim secret is configured, the caller must present it, which
   * is what makes an instance safe to leave sitting on a public URL before anyone has claimed it.
   *
   * Without a secret the claim is open to whoever reaches it first. That is the same model as
   * every comparable self-hosted CMS, and it is only safe because the window is meant to be the
   * minute between deploying and opening the link. Anything left unclaimed on a public URL should
   * set a secret.
   */
  public async claimInstance(input: ClaimInput): Promise<User> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('claimInstance')
    }

    const status = await this.getClaimStatus()
    if (!status.claimable) {
      throw new InvalidInputError(
        status.reason === 'unsupported'
          ? 'This instance does not support user accounts.'
          : 'This instance has already been claimed.',
        'claim'
      )
    }

    const expectedSecret = this.deps.claimSecret?.()
    if (expectedSecret) {
      // Constant-time-ish: compare full length regardless, so a wrong secret leaks no position.
      const provided = input.secret ?? ''
      const same =
        provided.length === expectedSecret.length &&
        provided.split('').reduce((acc, char, index) => acc | (char.charCodeAt(0) ^ expectedSecret.charCodeAt(index)), 0) === 0
      if (!same) {
        this.deps.logger.warn('Rejected a claim with an incorrect secret')
        throw new InvalidInputError('Incorrect claim secret.', 'secret')
      }
    }

    const admin = await this.createUser({
      username: input.username,
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'admin',
      permissions: [
        'content:read', 'content:write', 'content:delete',
        'users:read', 'users:write',
        'settings:read', 'settings:write',
        'media:upload', 'media:delete',
        'studio:access'
      ],
      isActive: true
    } as CreateUserData)

    // Two claims that raced each other both got past the check above and both created a user.
    // Resolve it the same way on every instance: the lowest id wins and the rest withdraw, so
    // the outcome does not depend on which request happens to run this first.
    const all = await this.listUsers({ limit: 10 })
    if (all.length > 1) {
      const winner = all.map(user => user.id).sort()[0]
      if (winner !== admin.id) {
        await this.deleteUser(admin.id).catch(() => undefined)
        this.deps.logger.warn('Lost a concurrent claim; withdrew the duplicate administrator', {
          withdrew: admin.id,
          winner
        })
        throw new InvalidInputError('This instance has already been claimed.', 'claim')
      }
      this.deps.logger.warn('Won a concurrent claim; another attempt will withdraw', { winner })
    }

    this.deps.logger.info('Instance claimed', { userId: admin.id, username: admin.username })
    return admin
  }

  // Development utility: Setup admin user from environment variables
  public async setupAdminFromEnv(): Promise<User | null> {
    const adminEmail = (typeof process !== 'undefined' ? process.env?.TROKKY_ADMIN_EMAIL : undefined)
    const adminPassword = (typeof process !== 'undefined' ? process.env?.TROKKY_ADMIN_PASSWORD : undefined)

    // Only proceed if environment variables are set
    if (!adminEmail || !adminPassword) {
      return null
    }

    // Check if any users exist
    try {
      const existingUsers = await this.listUsers({ limit: 1 })
      if (existingUsers.length > 0) {
        // Users already exist, don't create admin
        return null
      }
    } catch (error) {
      // If user operations aren't supported, skip
      if (error instanceof Error && error.message.includes('not supported by storage adapter')) {
        return null
      }
      throw error
    }

    // Create admin user from environment variables
    const adminUser = await this.createUser({
      username: 'admin',
      email: adminEmail,
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      permissions: ['content:read', 'content:write', 'content:delete', 'users:read', 'users:write', 'settings:read', 'settings:write', 'media:upload', 'media:delete', 'studio:access'],
      isActive: true,
      preferences: {
        theme: 'dark',
        language: 'en'
      }
    })

    // Log admin creation with security warning
    const envName = (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined)
    if (envName !== 'test') {
      console.log('🔧 Admin user created from environment variables')
      console.log(`   Email: ${adminEmail}`)
      console.log('   Username: admin')

      // Enhanced password strength warnings
      const isWeakPassword = this.deps.checkWeakPassword(adminPassword)
      if (isWeakPassword.isWeak) {
        console.warn('')
        console.warn('🚨 SECURITY WARNING: Weak admin password detected!')
        console.warn(`   Reason: ${isWeakPassword.reason}`)
        console.warn('   Please use a strong password with:')
        console.warn('   • At least 12 characters')
        console.warn('   • Mixed case letters (A-z)')
        console.warn('   • Numbers (0-9)')
        console.warn('   • Special characters (!@#$%^&*)')
        console.warn('   • No common words or patterns')
        if (envName === 'production') {
          console.warn('🔥 CRITICAL: Change this password immediately in production!')
        }
      } else {
        console.log('✅ Password strength check passed')
      }
      console.log('')
    }

    return adminUser
  }
}
