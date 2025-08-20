import { getUniversalCrypto, bytesToHex } from './universal-crypto.js';
export class IdGenerator {
    constructor() {
        this.counter = 0;
        this.crypto = getUniversalCrypto();
        // Generate a unique instance ID for this generator
        const bytes = this.crypto.getRandomBytes(4);
        this.instanceId = bytesToHex(bytes);
    }
    generate(options = {}) {
        const { prefix = '', length = 12, includeTimestamp = true } = options;
        let id = '';
        if (prefix) {
            id += `${prefix}-`;
        }
        if (includeTimestamp) {
            // Use timestamp in base36 for shorter IDs
            id += Date.now().toString(36);
            id += '-';
        }
        // Add instance ID to prevent collisions across instances
        id += this.instanceId;
        // Add counter to prevent collisions within same millisecond
        id += '-';
        id += (++this.counter).toString(36).padStart(2, '0');
        // Add random bytes for additional entropy
        const remainingLength = Math.max(4, length - id.length);
        const randomBytesNeeded = Math.ceil(remainingLength / 2);
        const randomBytesArray = this.crypto.getRandomBytes(randomBytesNeeded);
        const randomPart = bytesToHex(randomBytesArray).slice(0, remainingLength);
        id += randomPart;
        return id;
    }
    generateUUID() {
        // Generate a proper UUID v4
        const bytes = this.crypto.getRandomBytes(16);
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
    validateId(id) {
        if (typeof id !== 'string' || id.length === 0) {
            return false;
        }
        // Basic validation - only alphanumeric, hyphens, and underscores
        return /^[a-zA-Z0-9-_]+$/.test(id) && id.length <= 100;
    }
    reset() {
        this.counter = 0;
    }
}
//# sourceMappingURL=id-generator.js.map