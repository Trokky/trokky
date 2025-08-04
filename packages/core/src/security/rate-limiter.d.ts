export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (operation: string, context?: Record<string, unknown>) => string;
}
export declare class RateLimiter {
    private operationCounts;
    private readonly defaultConfig;
    constructor(config?: Partial<RateLimitConfig>);
    private config;
    checkRateLimit(operation: string, context?: Record<string, unknown>): Promise<void>;
    cleanup(): void;
    getRemainingRequests(operation: string): number;
}
//# sourceMappingURL=rate-limiter.d.ts.map