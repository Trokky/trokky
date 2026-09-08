import { createHash, timingSafeEqual } from 'crypto'
import type { CryptoAdapter } from '../crypto/adapter.js'
import { SecurityValidator } from '../security/validation.js'
import { RateLimiter } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import { DocumentNotFoundError } from '../errors/index.js'
import type { AppTokenCreationResult } from '../security/auth.js'
import type { AuditEvent } from '../core/engine.js'
import {
  DataStorageAdapter,
  AppToken,
  AppTokenListOptions,
  CreateAppTokenData
} from '../types/index.js'

export interface TokenServiceDependencies {
  dataStorage: DataStorageAdapter
  idGenerator: IdGenerator
  cryptoAdapter: CryptoAdapter
  rateLimiter?: RateLimiter
  securityEnabled: boolean
  logAuditEvent: (event: AuditEvent) => void
}

/**
 * Application token management (creation, validation, revocation).
 */
export class TokenService {
  constructor(private readonly deps: TokenServiceDependencies) {}

  // App Token management operations
  public async listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('listAppTokens')
    }

    // App token operations are handled by data storage adapter
    return await this.deps.dataStorage.listAppTokens(options)
  }

  public async createAppToken(tokenData: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('createAppToken')
    }

    // App token operations are handled by data storage adapter

    try {
      // Generate token and hash using SHA256 (fast) - bcrypt is unnecessary for API tokens
      // API tokens are long random strings, not user-chosen passwords, so SHA256 is secure
      const token = this.deps.cryptoAdapter.generateSecureRandom(32)
      const tokenHash = createHash('sha256').update(token).digest('hex')

      const now = new Date().toISOString()
      const tokenId = this.deps.idGenerator.generate()

      const appToken: AppToken = {
        id: tokenId,
        name: tokenData.name,
        description: tokenData.description,
        tokenHash,
        permissions: tokenData.permissions,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy,
        lastUsedAt: undefined,
        expiresAt: tokenData.expiresAt
      }

      const savedToken = await this.deps.dataStorage.saveAppToken(tokenId, appToken)

      return {
        success: true,
        token, // Plain text token (only returned once)
        appToken: savedToken
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create app token'
      }
    }
  }

  public async getAppToken(id: string): Promise<AppToken | null> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getAppToken')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // App token operations are handled by data storage adapter
    return await this.deps.dataStorage.getAppToken(id)
  }

  public async validateAppToken(token: string): Promise<{ valid: boolean; appToken?: AppToken; error?: string }> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('validateAppToken')
    }

    try {
      // Hash the provided token with SHA256 for comparison
      const providedHash = createHash('sha256').update(token).digest('hex')

      // Get all active app tokens and check if any match the hash
      const tokens = await this.deps.dataStorage.listAppTokens({ isActive: true })

      for (const appToken of tokens) {
        // Use constant-time comparison to prevent timing attacks
        if (appToken.tokenHash && appToken.tokenHash.length === providedHash.length) {
          const storedBuffer = Buffer.from(appToken.tokenHash, 'hex')
          const providedBuffer = Buffer.from(providedHash, 'hex')
          if (timingSafeEqual(storedBuffer, providedBuffer)) {
            // Update last used timestamp and usage count
            const updatedToken: AppToken = {
              ...appToken,
              lastUsedAt: new Date().toISOString(),
              usageCount: (appToken.usageCount || 0) + 1
            }

            await this.deps.dataStorage.saveAppToken(appToken.id, updatedToken)

            return { valid: true, appToken: updatedToken }
          }
        }
      }

      return { valid: false, error: 'Invalid app token' }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'App token validation failed'
      }
    }
  }

  public async deleteAppToken(id: string): Promise<void> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('deleteAppToken')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // App token operations are handled by data storage adapter

    const existingToken = await this.getAppToken(id)
    if (!existingToken) {
      throw new DocumentNotFoundError('tokens', id)
    }

    await this.deps.dataStorage.deleteAppToken(id)

    // Log audit event
    this.deps.logAuditEvent({
      type: 'app_token_deleted',
      targetTokenId: id,
      tokenName: existingToken.name,
      action: `App token deleted`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        permissions: existingToken.permissions,
        createdBy: existingToken.createdBy
      }
    })
  }
}
