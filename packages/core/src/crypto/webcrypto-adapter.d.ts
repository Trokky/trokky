/**
 * Web Crypto API adapter for edge environments
 * Compatible with Cloudflare Workers, Deno, Vercel Edge, etc.
 */
import type { CryptoAdapter, JWTOptions, CryptoAdapterOptions } from './adapter.js';
export declare class WebCryptoAdapter implements CryptoAdapter {
    private saltRounds;
    constructor(options?: CryptoAdapterOptions);
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    generateJWT(payload: Record<string, any>, secret: string, options?: JWTOptions): Promise<string>;
    verifyJWT(token: string, secret: string): Promise<Record<string, any> | null>;
    generateSecureRandom(length?: number): string;
    private sign;
    private verify;
    private base64UrlEncode;
    private base64UrlDecode;
    private base64UrlDecodeToBuffer;
    private bufferToBase64;
    private base64ToBuffer;
    private parseExpirationString;
}
//# sourceMappingURL=webcrypto-adapter.d.ts.map