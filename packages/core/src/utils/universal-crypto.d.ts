/**
 * Universal crypto utilities that work across all JavaScript environments
 * Supports: Browser, Node.js, Cloudflare Workers, Deno, Bun, etc.
 */
export interface UniversalCrypto {
    getRandomBytes(length: number): Uint8Array;
}
/**
 * Detect and return the best crypto implementation for the current environment
 */
export declare function getUniversalCrypto(): UniversalCrypto;
/**
 * Convert byte array to hex string
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Generate a cryptographically secure random hex string
 */
export declare function generateRandomHex(length: number): string;
/**
 * Generate a UUID v4
 */
export declare function generateUUID(): string;
/**
 * Generate a cryptographically secure random integer between 0 and max (exclusive)
 * Uses rejection sampling to avoid modulo bias
 */
export declare function getSecureRandomInt(max: number): number;
/**
 * Cryptographically secure array shuffling using Fisher-Yates algorithm
 */
export declare function secureShuffleArray<T>(array: T[]): T[];
/**
 * Generate a cryptographically secure password
 */
export interface SecurePasswordOptions {
    length?: number;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecialChars?: boolean;
    customChars?: string;
    excludeSimilar?: boolean;
}
export declare function generateSecurePassword(options?: SecurePasswordOptions): string;
//# sourceMappingURL=universal-crypto.d.ts.map