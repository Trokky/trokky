import { detectCryptoAdapter, type CryptoAdapter, type CryptoAdapterOptions } from '../crypto/adapter.js'
import { SchemaRegistry } from '../schema/registry.js'
import { DocumentValidator } from '../validation/validator.js'
import { SecurityValidator } from '../security/validation.js'
import { RateLimiter, RateLimitConfig } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import { createLogger } from '../utils/logger.js'
import { createImageProcessor, type ImageProcessor, type ImageProcessorConfig } from '../media/image-processor.js'
import { 
  SchemaNotFoundError, 
  DocumentNotFoundError, 
  ValidationError,
  InvalidInputError
} from '../errors/index.js'
import { 
  TrokkyConfig, 
  StorageAdapter, 
  Document, 
  DocumentData, 
  ListOptions,
  MediaFile,
  MediaMetadata,
  ContentSchema,
  ValidationResult,
  User,
  CreateUserData,
  UpdateUserData,
  UserListOptions,
  Permission,
  UserSession
} from '../types/index.js'

export interface TrokkyCoreOptions {
  schemaRegistry?: SchemaRegistry
  validator?: DocumentValidator
  idGenerator?: IdGenerator
  rateLimiter?: RateLimiter
  enableSecurity?: boolean
  setupAdminFromEnv?: boolean // Automatically create admin user from env vars on startup
  jwtSecret?: string // JWT signing secret for token authentication
  auditLogger?: (event: AuditEvent) => void // Optional audit logging function
  cryptoAdapter?: CryptoAdapter // Custom crypto adapter (auto-detected if not provided)
  cryptoOptions?: CryptoAdapterOptions // Options for crypto adapter
  imageProcessor?: ImageProcessor // Custom image processor (auto-created if not provided)
  imageProcessorConfig?: ImageProcessorConfig // Image processor configuration
}

export interface AuditEvent {
  type: 'user_created' | 'user_updated' | 'user_deleted' | 'user_login' | 'user_logout' | 'admin_access'
  userId?: string
  targetUserId?: string
  username?: string
  action: string
  timestamp: string
  ipAddress?: string
  userAgent?: string
  success: boolean
  details?: Record<string, unknown>
}

export class TrokkyCore {
  private storage: StorageAdapter
  private schemas: SchemaRegistry
  private validator: DocumentValidator
  private idGenerator: IdGenerator
  private rateLimiter?: RateLimiter
  private securityEnabled: boolean
  private options: TrokkyCoreOptions
  private jwtSecret: string
  private auditLogger?: (event: AuditEvent) => void
  private cryptoAdapter: CryptoAdapter
  private imageProcessor: ImageProcessor
  private logger = createLogger('core', 'TrokkyCore')
  private auditLog = createLogger('core', 'Audit')

  constructor(
    config: TrokkyConfig, 
    storageAdapter: StorageAdapter,
    options: TrokkyCoreOptions = {}
  ) {
    this.storage = storageAdapter
    this.options = options
    this.schemas = options.schemaRegistry || new SchemaRegistry(config.schemas)
    this.validator = options.validator || new DocumentValidator(this.schemas)
    this.idGenerator = options.idGenerator || new IdGenerator()
    this.securityEnabled = options.enableSecurity ?? config.security?.validateInput ?? true
    
    // Initialize JWT secret (use provided secret, environment variable, or generate one)
    this.jwtSecret = options.jwtSecret || 
                     process.env.TROKKY_JWT_SECRET || 
                     this.generateSecureSecret()
    
    // Initialize audit logger
    this.auditLogger = options.auditLogger
    
    // Initialize crypto adapter
    this.cryptoAdapter = options.cryptoAdapter || detectCryptoAdapter({
      ...options.cryptoOptions,
      adapterType: options.cryptoOptions?.adapterType || 'auto'
    })
    
    // Initialize image processor from config or options
    const imageProcessorConfig = options.imageProcessorConfig || {
      type: config.media?.imageProcessor || 'none',
      variants: config.media?.imageVariants || [],
      options: config.media?.imageProcessorOptions || {}
    }
    this.imageProcessor = options.imageProcessor || createImageProcessor(imageProcessorConfig)
    
    if (config.security?.rateLimitEnabled || config.api?.rateLimit) {
      const rateLimitConfig: RateLimitConfig = {
        windowMs: config.api?.rateLimit?.windowMs || 60 * 1000,
        maxRequests: config.api?.rateLimit?.maxRequests || 1000
      }
      this.rateLimiter = options.rateLimiter || new RateLimiter(rateLimitConfig)
    }
  }

  // Initialization
  public async init(): Promise<void> {
    // Setup admin user from environment variables if configured
    if (this.options.setupAdminFromEnv) {
      await this.setupAdminFromEnv()
    }
  }

  // Document operations
  public async getDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    id: string
  ): Promise<(Document & T) | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getDocument')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    const document = await this.storage.getDocument(collection, id)
    return document as (Document & T) | null
  }

  public async saveDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    data: DocumentData & T & { id?: string }
  ): Promise<Document & T> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('saveDocument')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentData(data)
      
      if (data.id) {
        SecurityValidator.validateDocumentId(data.id)
      }
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Validate document against schema
    const validation = this.validateDocument(collection, data)
    if (!validation.valid) {
      throw new ValidationError('Document validation failed', validation.errors)
    }

    // Generate ID if not provided
    const id = data.id || this.idGenerator.generate({ prefix: collection })
    const { id: _, ...documentData } = data

    const savedDocument = await this.storage.saveDocument(collection, id, documentData)
    return savedDocument as Document & T
  }

  public async listDocuments<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    options?: ListOptions
  ): Promise<(Document & T)[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listDocuments')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    const sanitizedOptions = this.securityEnabled 
      ? SecurityValidator.sanitizeListOptions(options)
      : options

    const documents = await this.storage.listDocuments(collection, sanitizedOptions)
    return documents as (Document & T)[]
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteDocument')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Check if document exists
    const existingDocument = await this.storage.getDocument(collection, id)
    if (!existingDocument) {
      throw new DocumentNotFoundError(collection, id)
    }

    return await this.storage.deleteDocument(collection, id)
  }

  // Media operations
  public async uploadMedia(file: File): Promise<MediaFile> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('uploadMedia')
    }

    if (this.securityEnabled) {
      this.validateMediaFile(file)
    }

    const metadata: MediaMetadata = {
      id: this.idGenerator.generate({ prefix: 'media' }),
      filename: file.name,
      contentType: file.type,
      size: file.size,
      extension: this.getFileExtension(file.name)
    }

    // Upload to storage first
    const mediaFile = await this.storage.uploadFile(file, metadata)

    // Process image if it's an image file
    if (file.type.startsWith('image/')) {
      try {
        const processedImage = await this.imageProcessor.processImage(file, {
          id: metadata.id,
          filename: metadata.filename,
          path: mediaFile.url
        })

        // Store processed image metadata in the media file
        mediaFile.metadata = {
          ...mediaFile.metadata,
          imageVariants: processedImage.variants,
          originalDimensions: {
            width: processedImage.original.width,
            height: processedImage.original.height
          }
        }
      } catch (error) {
        // Log error but don't fail the upload - image processing is optional
        this.logger.warn('Image processing failed', { 
          fileId: metadata.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return mediaFile
  }

  public async getMedia(id: string): Promise<MediaFile | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.storage.getFile(id)
  }

  public async getMediaContent(id: string): Promise<ArrayBuffer | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getMediaContent')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.storage.getFileContent(id)
  }

  public async listMedia(options?: { limit?: number; offset?: number }): Promise<MediaFile[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listMedia')
    }

    // Use the storage adapter's listMedia method if available
    if (!this.storage.listMedia) {
      throw new Error('Media listing not supported by storage adapter')
    }
    
    return await this.storage.listMedia(options || {})
  }

  public async deleteMedia(id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // Check if media exists
    const existingMedia = await this.storage.getFile(id)
    if (!existingMedia) {
      throw new DocumentNotFoundError('media', id)
    }

    // Delete image variants if it's an image
    if (existingMedia.contentType.startsWith('image/')) {
      try {
        await this.imageProcessor.deleteImage(id)
      } catch (error) {
        // Log error but don't fail the deletion - variants cleanup is optional
        this.logger.warn('Image variants cleanup failed', { 
          fileId: id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return await this.storage.deleteFile(id)
  }

  // Schema operations
  public getSchema(name: string): ContentSchema | null {
    return this.schemas.getSchema(name)
  }

  public getAllSchemas(): ContentSchema[] {
    return this.schemas.getAllSchemas()
  }

  public validateDocument(collection: string, data: unknown): ValidationResult {
    return this.validator.validateDocument(collection, data)
  }

  // Image processing operations
  public getImageUrl(imageId: string, variantName?: string): string {
    return this.imageProcessor.getImageUrl(imageId, variantName)
  }

  public async getImageProcessor(): Promise<ImageProcessor> {
    return this.imageProcessor
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      const storageHealthy = await this.storage.healthCheck()
      const schemasLoaded = this.schemas.getAllSchemas().length > 0
      const imageProcessorHealthy = await this.imageProcessor.healthCheck()
      
      return storageHealthy && schemasLoaded && imageProcessorHealthy
    } catch {
      return false
    }
  }

  // Utility methods
  private validateMediaFile(file: File): void {
    const maxSize = 100 * 1024 * 1024 // 100MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'text/plain'
    ]

    if (file.size > maxSize) {
      throw new InvalidInputError(`File too large (max ${maxSize / 1024 / 1024}MB)`, 'file')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new InvalidInputError(`File type not allowed: ${file.type}`, 'file')
    }

    // Validate filename
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      throw new InvalidInputError('Invalid filename characters', 'file')
    }
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()! : ''
  }

  // User management operations (system entities)
  public async createUser(userData: CreateUserData): Promise<User> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('createUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateEmail(userData.email)
      SecurityValidator.validateUsername(userData.username)
    }

    if (!this.storage.saveUser) {
      throw new Error('User operations not supported by storage adapter')
    }

    // Check if user already exists
    const existingUserByEmail = await this.getUserByEmail(userData.email)
    if (existingUserByEmail) {
      throw new Error(`User with email ${userData.email} already exists`)
    }

    const existingUserByUsername = await this.getUserByUsername(userData.username)
    if (existingUserByUsername) {
      throw new Error(`User with username ${userData.username} already exists`)
    }

    // Hash password before saving
    const passwordHash = await this.hashPassword(userData.password)
    
    const userId = this.idGenerator.generate({ prefix: 'user' })
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

    const createdUser = await this.storage.saveUser(userId, userToSave)
    
    // Log audit event
    this.logAuditEvent({
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
    
    return createdUser
  }

  public async getUser(id: string): Promise<User | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.storage.getUser) {
      throw new Error('User operations not supported by storage adapter')
    }

    return await this.storage.getUser(id)
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getUserByUsername')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateUsername(username)
    }

    if (!this.storage.getUserByUsername) {
      throw new Error('User operations not supported by storage adapter')
    }

    return await this.storage.getUserByUsername(username)
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getUserByEmail')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateEmail(email)
    }

    if (!this.storage.getUserByEmail) {
      throw new Error('User operations not supported by storage adapter')
    }

    return await this.storage.getUserByEmail(email)
  }

  public async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('updateUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
      if (userData.email) SecurityValidator.validateEmail(userData.email)
      if (userData.username) SecurityValidator.validateUsername(userData.username)
    }

    if (!this.storage.saveUser) {
      throw new Error('User operations not supported by storage adapter')
    }

    const existingUser = await this.getUser(id)
    if (!existingUser) {
      throw new DocumentNotFoundError('users', id)
    }

    const updatedUserData: Partial<User> = {
      ...userData,
      updatedAt: new Date().toISOString()
    }

    const updatedUser = await this.storage.saveUser(id, updatedUserData)
    
    // Log audit event
    this.logAuditEvent({
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
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listUsers')
    }

    if (!this.storage.listUsers) {
      throw new Error('User operations not supported by storage adapter')
    }

    return await this.storage.listUsers(options)
  }

  public async deleteUser(id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.storage.deleteUser) {
      throw new Error('User operations not supported by storage adapter')
    }

    const existingUser = await this.getUser(id)
    if (!existingUser) {
      throw new DocumentNotFoundError('users', id)
    }

    await this.storage.deleteUser(id)
    
    // Log audit event
    this.logAuditEvent({
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

  // Authentication utilities
  public async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await this.cryptoAdapter.verifyPassword(plainPassword, hashedPassword)
  }

  private async hashPassword(password: string): Promise<string> {
    return await this.cryptoAdapter.hashPassword(password)
  }

  private getDefaultPermissions(role: string): Permission[] {
    switch (role) {
      case 'admin':
        return ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'upload_media', 'delete_media']
      case 'editor':
        return ['read', 'write', 'upload_media']
      case 'viewer':
        return ['read']
      default:
        return ['read']
    }
  }

  private checkWeakPassword(password: string): { isWeak: boolean; reason?: string } {
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
  public async generateAuthToken(user: User, expiresIn: string = '24h'): Promise<string> {
    const payload: Omit<UserSession, 'loginAt' | 'expiresAt'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    }
    
    return await this.cryptoAdapter.generateJWT(payload, this.jwtSecret, { expiresIn })
  }

  public async verifyAuthToken(token: string): Promise<UserSession | null> {
    const decoded = await this.cryptoAdapter.verifyJWT(token, this.jwtSecret)
    
    if (!decoded || !decoded.userId || !decoded.username || !decoded.role || !decoded.permissions) {
      return null
    }

    return {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      permissions: decoded.permissions,
      loginAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
    }
  }

  public async authenticateUser(username: string, password: string): Promise<{ user: User; token: string } | null> {
    try {
      // Get user by username
      const user = await this.getUserByUsername(username)
      if (!user || !user.isActive) {
        return null
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
      if (!isPasswordValid) {
        return null
      }

      // Update last login time
      await this.updateUser(user.id, { lastLoginAt: new Date().toISOString() })

      // Generate token
      const token = await this.generateAuthToken(user)

      // Log successful login
      this.logAuditEvent({
        type: 'user_login',
        userId: user.id,
        username: user.username,
        action: 'User authenticated successfully',
        timestamp: new Date().toISOString(),
        success: true,
        details: {
          role: user.role,
          lastLoginAt: new Date().toISOString()
        }
      })

      // Return user without password hash
      const { passwordHash, ...safeUser } = user
      return { 
        user: { ...safeUser, passwordHash: '' } as User, // Keep type but empty the hash
        token 
      }
    } catch (error) {
      console.error('Authentication failed:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }

  private generateSecureSecret(): string {
    // Generate a cryptographically secure random secret using crypto adapter
    // This will be called during initialization, but we need to create a temporary adapter
    const tempAdapter = detectCryptoAdapter()
    const secret = tempAdapter.generateSecureRandom(64)
    
    // Warn if using generated secret (should use environment variable in production)
    if (process.env.NODE_ENV !== 'test') {
      console.warn('⚠️  Using auto-generated JWT secret. Set TROKKY_JWT_SECRET environment variable for production.')
    }
    
    return secret
  }

  public logAuditEvent(event: AuditEvent): void {
    // Always call custom audit logger if provided
    if (this.auditLogger) {
      this.auditLogger(event)
    }
    
    // Log through our structured logger system
    const logData = {
      type: event.type,
      action: event.action,
      user: event.username,
      target: event.targetUserId,
      timestamp: event.timestamp,
      ...event.details
    }
    
    if (event.success) {
      this.auditLog.info(`${event.type}: ${event.action}`, logData)
    } else {
      this.auditLog.warn(`${event.type}: ${event.action} - FAILED`, logData)
    }
  }

  // Development utility: Setup admin user from environment variables
  public async setupAdminFromEnv(): Promise<User | null> {
    const adminEmail = process.env.TROKKY_ADMIN_EMAIL
    const adminPassword = process.env.TROKKY_ADMIN_PASSWORD
    
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
      permissions: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'upload_media', 'delete_media'],
      isActive: true,
      preferences: {
        theme: 'dark',
        language: 'en'
      }
    })

    // Log admin creation with security warning
    if (process.env.NODE_ENV !== 'test') {
      console.log('🔧 Admin user created from environment variables')
      console.log(`   Email: ${adminEmail}`)
      console.log('   Username: admin')
      
      // Enhanced password strength warnings
      const isWeakPassword = this.checkWeakPassword(adminPassword)
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
        if (process.env.NODE_ENV === 'production') {
          console.warn('🔥 CRITICAL: Change this password immediately in production!')
        }
      } else {
        console.log('✅ Password strength check passed')
      }
      console.log('')
    }

    return adminUser
  }

  // Rate limiter cleanup (call periodically)
  public cleanup(): void {
    if (this.rateLimiter) {
      this.rateLimiter.cleanup()
    }
  }
}