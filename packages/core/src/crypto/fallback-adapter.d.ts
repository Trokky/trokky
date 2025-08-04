/**
 * Fallback crypto adapter for environments without proper crypto support
 * WARNING: This adapter provides minimal security and should only be used for development
 */
import type { CryptoAdapter, JWTOptions, CryptoAdapterOptions } from './adapter.js';
export declare class FallbackCryptoAdapter implements CryptoAdapter {
    private saltRounds;
    private hasLoggedWarning;
    constructor(options?: CryptoAdapterOptions);
    private logSecurityWarning;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    generateJWT(payload: Record<string, any>, secret: string, options?: JWTOptions): Promise<string>;
    verifyJWT(token: string, secret: string): Promise<Record<string, any> | null>;
    generateSecureRandom(length?: number): string;
    private generateSimpleSalt;
    private simpleHash;
    private base64Encode;
    private base64Decode;
    private parseExpirationString;
}
//# sourceMappingURL=fallback-adapter.d.ts.map