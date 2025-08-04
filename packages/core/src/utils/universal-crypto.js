"use strict";
/**
 * Universal crypto utilities that work across all JavaScript environments
 * Supports: Browser, Node.js, Cloudflare Workers, Deno, Bun, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUniversalCrypto = getUniversalCrypto;
exports.bytesToHex = bytesToHex;
exports.generateRandomHex = generateRandomHex;
exports.generateUUID = generateUUID;
exports.getSecureRandomInt = getSecureRandomInt;
exports.secureShuffleArray = secureShuffleArray;
exports.generateSecurePassword = generateSecurePassword;
/**
 * Detect and return the best crypto implementation for the current environment
 */
function getUniversalCrypto() {
    // Web Crypto API (browser, Cloudflare Workers, Deno)
    if (typeof globalThis !== 'undefined' && globalThis.crypto && 'getRandomValues' in globalThis.crypto) {
        return {
            getRandomBytes(length) {
                const array = new Uint8Array(length);
                globalThis.crypto.getRandomValues(array);
                return array;
            }
        };
    }
    // Node.js environment - use dynamic import to avoid bundling
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return {
            getRandomBytes(length) {
                try {
                    // Use eval to prevent bundlers from trying to resolve this
                    const crypto = eval('require')('crypto');
                    return new Uint8Array(crypto.randomBytes(length));
                }
                catch (error) {
                    // Fallback if crypto is not available
                    return getFallbackRandomBytes(length);
                }
            }
        };
    }
    // Fallback for any other environment
    return {
        getRandomBytes: getFallbackRandomBytes
    };
}
/**
 * Fallback random bytes implementation using Math.random()
 * Not cryptographically secure - only for environments without crypto support
 */
function getFallbackRandomBytes(length) {
    console.warn('⚠️ Using Math.random() fallback for crypto operations. This is not cryptographically secure.');
    const array = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
    }
    return array;
}
/**
 * Convert byte array to hex string
 */
function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * Generate a cryptographically secure random hex string
 */
function generateRandomHex(length) {
    const crypto = getUniversalCrypto();
    const bytes = crypto.getRandomBytes(Math.ceil(length / 2));
    return bytesToHex(bytes).slice(0, length);
}
/**
 * Generate a UUID v4
 */
function generateUUID() {
    const crypto = getUniversalCrypto();
    const bytes = crypto.getRandomBytes(16);
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytesToHex(bytes);
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
    ].join('-');
}
/**
 * Generate a cryptographically secure random integer between 0 and max (exclusive)
 * Uses rejection sampling to avoid modulo bias
 */
function getSecureRandomInt(max) {
    if (max <= 0)
        throw new Error('Max must be positive');
    if (max > 256)
        throw new Error('Max must be <= 256 for single byte sampling');
    const crypto = getUniversalCrypto();
    // Calculate rejection threshold to avoid modulo bias
    const threshold = Math.floor(256 / max) * max;
    while (true) {
        const randomByte = crypto.getRandomBytes(1)[0];
        if (randomByte < threshold) {
            return randomByte % max;
        }
        // Reject and retry if above threshold
    }
}
/**
 * Cryptographically secure array shuffling using Fisher-Yates algorithm
 */
function secureShuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        // For large arrays, we need to handle max > 256
        let j;
        if (i < 256) {
            j = getSecureRandomInt(i + 1);
        }
        else {
            // For larger indices, use multiple bytes
            const crypto = getUniversalCrypto();
            const bytes = crypto.getRandomBytes(4); // 32-bit random number
            const randomValue = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
            j = randomValue % (i + 1);
        }
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function generateSecurePassword(options = {}) {
    const { length = 16, includeUppercase = true, includeLowercase = true, includeNumbers = true, includeSpecialChars = true, customChars = '', excludeSimilar = false } = options;
    if (length < 1)
        throw new Error('Password length must be at least 1');
    if (length > 1000)
        throw new Error('Password length too large');
    let charset = '';
    const requiredChars = [];
    // Build character sets
    if (includeLowercase) {
        const lowercase = excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
        charset += lowercase;
        requiredChars.push(lowercase[getSecureRandomInt(lowercase.length)]);
    }
    if (includeUppercase) {
        const uppercase = excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        charset += uppercase;
        requiredChars.push(uppercase[getSecureRandomInt(uppercase.length)]);
    }
    if (includeNumbers) {
        const numbers = excludeSimilar ? '23456789' : '0123456789';
        charset += numbers;
        requiredChars.push(numbers[getSecureRandomInt(numbers.length)]);
    }
    if (includeSpecialChars) {
        const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        charset += special;
        requiredChars.push(special[getSecureRandomInt(special.length)]);
    }
    if (customChars) {
        charset += customChars;
    }
    if (!charset) {
        throw new Error('At least one character type must be included');
    }
    // Convert charset to array for secure selection
    const charArray = charset.split('');
    // Start with required characters
    const passwordChars = [...requiredChars];
    // Fill remaining length with random characters from full charset
    while (passwordChars.length < length) {
        const randomIndex = charArray.length < 256
            ? getSecureRandomInt(charArray.length)
            : getSecureRandomInt(256) % charArray.length; // Fallback for large charsets
        passwordChars.push(charArray[randomIndex]);
    }
    // Securely shuffle the password to avoid predictable patterns
    return secureShuffleArray(passwordChars).join('');
}
