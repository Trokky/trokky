/**
 * Node.js crypto adapter using bcrypt and jsonwebtoken
 * Best performance and security for Node.js environments
 */
import type { CryptoAdapter, JWTOptions, CryptoAdapterOptions } from './adapter.js';
export declare class NodeCryptoAdapter implements CryptoAdapter {
    private saltRounds;
    private bcrypt;
    private jwt;
    private crypto;
    constructor(options?: CryptoAdapterOptions);
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    generateJWT(payload: Record<string, any>, secret: string, options?: JWTOptions): Promise<string>;
    verifyJWT(token: string, secret: string): Promise<Record<string, any> | null>;
    generateSecureRandom(length?: number): string;
}
//# sourceMappingURL=node-adapter.d.ts.map