/**
 * Web Crypto API adapter for edge environments
 * Compatible with Cloudflare Workers, Deno, Vercel Edge, etc.
 */
export class WebCryptoAdapter {
    saltRounds;
    constructor(options = {}) {
        this.saltRounds = options.saltRounds || 12;
        if (!crypto || !crypto.subtle) {
            throw new Error('Web Crypto API not available in this environment');
        }
    }
    async hashPassword(password) {
        try {
            // Generate a random salt
            const salt = crypto.getRandomValues(new Uint8Array(16));
            // Encode password as UTF-8
            const passwordBuffer = new TextEncoder().encode(password);
            // Import password as key material
            const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
            // Derive key using PBKDF2
            const derivedKey = await crypto.subtle.deriveBits({
                name: 'PBKDF2',
                salt: salt,
                iterations: Math.pow(2, this.saltRounds), // 2^12 = 4096 iterations by default
                hash: 'SHA-256'
            }, keyMaterial, 256 // 32 bytes
            );
            // Combine salt and derived key
            const hashBuffer = new Uint8Array(salt.length + derivedKey.byteLength);
            hashBuffer.set(salt);
            hashBuffer.set(new Uint8Array(derivedKey), salt.length);
            // Return base64 encoded hash
            return this.bufferToBase64(hashBuffer);
        }
        catch (error) {
            throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async verifyPassword(password, hash) {
        try {
            // Decode the hash
            const hashBuffer = this.base64ToBuffer(hash);
            // Extract salt (first 16 bytes) and stored hash
            const salt = hashBuffer.slice(0, 16);
            const storedHash = hashBuffer.slice(16);
            // Encode password as UTF-8
            const passwordBuffer = new TextEncoder().encode(password);
            // Import password as key material
            const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
            // Derive key using same parameters
            const derivedKey = await crypto.subtle.deriveBits({
                name: 'PBKDF2',
                salt: salt,
                iterations: Math.pow(2, this.saltRounds),
                hash: 'SHA-256'
            }, keyMaterial, 256);
            // Compare derived key with stored hash
            const derivedArray = new Uint8Array(derivedKey);
            // Constant-time comparison
            if (derivedArray.length !== storedHash.length) {
                return false;
            }
            let result = 0;
            for (let i = 0; i < derivedArray.length; i++) {
                result |= derivedArray[i] ^ storedHash[i];
            }
            return result === 0;
        }
        catch (error) {
            console.error('Password verification failed:', error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }
    async generateJWT(payload, secret, options = {}) {
        try {
            // Create header
            const header = {
                alg: 'HS256',
                typ: 'JWT'
            };
            // Add standard claims to payload
            const now = Math.floor(Date.now() / 1000);
            const jwtPayload = {
                ...payload,
                iat: now
            };
            // Add expiration if specified
            if (options.expiresIn) {
                if (typeof options.expiresIn === 'string') {
                    // Parse expiration string (e.g., "24h", "7d")
                    jwtPayload.exp = now + this.parseExpirationString(options.expiresIn);
                }
                else {
                    jwtPayload.exp = now + options.expiresIn;
                }
            }
            if (options.issuer)
                jwtPayload.iss = options.issuer;
            if (options.audience)
                jwtPayload.aud = options.audience;
            // Encode header and payload
            const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
            const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));
            // Create signature
            const message = `${encodedHeader}.${encodedPayload}`;
            const signature = await this.sign(message, secret);
            return `${message}.${signature}`;
        }
        catch (error) {
            throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async verifyJWT(token, secret) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }
            const [encodedHeader, encodedPayload, signature] = parts;
            // Verify signature
            const message = `${encodedHeader}.${encodedPayload}`;
            const isValid = await this.verify(message, signature, secret);
            if (!isValid) {
                return null;
            }
            // Decode payload
            const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return null;
            }
            return payload;
        }
        catch (error) {
            return null;
        }
    }
    generateSecureRandom(length = 64) {
        const buffer = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Helper methods
    async sign(message, secret) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
        return this.base64UrlEncode(new Uint8Array(signature));
    }
    async verify(message, signature, secret) {
        try {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
            const signatureBuffer = this.base64UrlDecodeToBuffer(signature);
            const messageBuffer = encoder.encode(message);
            return await crypto.subtle.verify('HMAC', key, signatureBuffer.buffer, messageBuffer.buffer);
        }
        catch {
            return false;
        }
    }
    base64UrlEncode(data) {
        const base64 = typeof data === 'string'
            ? btoa(data)
            : btoa(String.fromCharCode(...data));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    base64UrlDecode(data) {
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        return atob(padded);
    }
    base64UrlDecodeToBuffer(data) {
        const decoded = this.base64UrlDecode(data);
        return new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
    }
    bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...buffer));
    }
    base64ToBuffer(base64) {
        const decoded = atob(base64);
        return new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
    }
    parseExpirationString(expiration) {
        const match = expiration.match(/^(\d+)([smhdw])$/);
        if (!match) {
            throw new Error(`Invalid expiration format: ${expiration}`);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers = {
            s: 1,
            m: 60,
            h: 60 * 60,
            d: 60 * 60 * 24,
            w: 60 * 60 * 24 * 7
        };
        return value * multipliers[unit];
    }
}
