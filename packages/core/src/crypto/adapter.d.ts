/**
 * Crypto adapter interface for different deployment environments
 * Supports both Node.js and edge runtime environments
 */
export interface CryptoAdapter {
    /**
     * Hash a password using the environment's best available method
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verify a password against its hash
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Generate a JWT token
     */
    generateJWT(payload: Record<string, any>, secret: string, options?: JWTOptions): Promise<string>;
    /**
     * Verify and decode a JWT token
     */
    verifyJWT(token: string, secret: string): Promise<Record<string, any> | null>;
    /**
     * Generate a cryptographically secure random string
     */
    generateSecureRandom(length: number): string;
}
export interface JWTOptions {
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
}
export interface CryptoAdapterOptions {
    /**
     * Force a specific adapter type
     */
    adapterType?: 'node' | 'webcrypto' | 'auto';
    /**
     * Custom salt rounds for password hashing (default: 12)
     */
    saltRounds?: number;
}
/**
 * Detect the best crypto adapter for the current environment
 */
export declare function detectCryptoAdapter(options?: CryptoAdapterOptions): CryptoAdapter;
//# sourceMappingURL=adapter.d.ts.map