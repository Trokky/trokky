import { RateLimitError } from '../errors/index'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (operation: string, context?: Record<string, unknown>) => string
}

export class RateLimiter {
  private operationCounts = new Map<string, { count: number; windowStart: number }>()
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000
  }

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config }
  }

  private config: RateLimitConfig

  public async checkRateLimit(
    operation: string, 
    context?: Record<string, unknown>
  ): Promise<void> {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(operation, context)
      : operation

    const now = Date.now()
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs
    
    const current = this.operationCounts.get(key)

    if (!current || current.windowStart < windowStart) {
      // New window or first request
      this.operationCounts.set(key, { count: 1, windowStart })
      return
    }

    if (current.count >= this.config.maxRequests) {
      throw new RateLimitError(operation)
    }

    current.count++
  }

  public cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.config.windowMs * 2 // Keep 2 windows of history

    for (const [key, data] of this.operationCounts.entries()) {
      if (data.windowStart < cutoff) {
        this.operationCounts.delete(key)
      }
    }
  }

  public getRemainingRequests(operation: string): number {
    const now = Date.now()
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs
    
    const current = this.operationCounts.get(operation)
    
    if (!current || current.windowStart < windowStart) {
      return this.config.maxRequests
    }

    return Math.max(0, this.config.maxRequests - current.count)
  }
}