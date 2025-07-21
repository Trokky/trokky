/**
 * Node.js crypto adapter using bcrypt and jsonwebtoken
 * Best performance and security for Node.js environments
 */

import type { CryptoAdapter, JWTOptions, CryptoAdapterOptions } from './adapter'

export class NodeCryptoAdapter implements CryptoAdapter {
  private saltRounds: number
  private bcrypt: any
  private jwt: any
  private crypto: any

  constructor(options: CryptoAdapterOptions = {}) {
    this.saltRounds = options.saltRounds || 12
    
    try {
      // Dynamic imports to avoid bundling issues
      this.bcrypt = require('bcrypt')
      this.jwt = require('jsonwebtoken')
      this.crypto = require('crypto')
    } catch (error) {
      throw new Error('Node.js crypto dependencies not available. Install bcrypt and jsonwebtoken packages.')
    }
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await this.bcrypt.hash(password, this.saltRounds)
    } catch (error) {
      throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await this.bcrypt.compare(password, hash)
    } catch (error) {
      console.error('Password verification failed:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }

  async generateJWT(payload: Record<string, any>, secret: string, options: JWTOptions = {}): Promise<string> {
    try {
      const jwtOptions: any = {}
      
      if (options.expiresIn) jwtOptions.expiresIn = options.expiresIn
      if (options.issuer) jwtOptions.issuer = options.issuer
      if (options.audience) jwtOptions.audience = options.audience

      return this.jwt.sign(payload, secret, jwtOptions)
    } catch (error) {
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
    try {
      const decoded = this.jwt.verify(token, secret)
      return decoded as Record<string, any>
    } catch (error) {
      // Token is invalid, expired, or malformed
      return null
    }
  }

  generateSecureRandom(length: number = 64): string {
    return this.crypto.randomBytes(length).toString('hex')
  }
}