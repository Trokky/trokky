"use strict";
/**
 * Authentication and Authorization Service
 *
 * Provides secure user authentication with JWT tokens and app token management.
 * Supports multiple authentication methods:
 * - User JWT sessions (for Studio access)
 * - App tokens (for API integrations)
 * - Service tokens (for internal communication)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUTH_CONFIG = exports.AuthenticationService = void 0;
const node_crypto_1 = require("node:crypto");
class AuthenticationService {
    constructor(config) {
        this.failedAttempts = new Map();
        this.config = config;
    }
    /**
     * Hash a password using bcrypt-compatible algorithm
     */
    async hashPassword(password) {
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
        return bcrypt.hash(password, this.config.bcryptRounds);
    }
    /**
     * Verify a password against its hash
     */
    async verifyPassword(password, hash) {
        try {
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
            return bcrypt.compare(password, hash);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Generate a secure JWT token for user authentication
     */
    async generateUserToken(user) {
        const jwt = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
        const payload = {
            type: 'user',
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(this.config.jwtExpiresIn)
        };
        const refreshPayload = {
            type: 'refresh',
            userId: user.id,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(this.config.refreshTokenExpiresIn)
        };
        const accessToken = jwt.sign(payload, this.config.jwtSecret);
        const refreshToken = jwt.sign(refreshPayload, this.config.jwtSecret);
        return { accessToken, refreshToken };
    }
    /**
     * Generate a secure app token for API access
     */
    async generateAppToken() {
        // Generate a secure random token (32 bytes = 256 bits)
        const tokenBytes = (0, node_crypto_1.randomBytes)(32);
        const token = tokenBytes.toString('base64url'); // URL-safe base64
        // Hash the token for secure storage
        const hash = (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
        return { token, hash };
    }
    /**
     * Create an app token with specified permissions
     */
    async createAppToken(data, createdBy) {
        try {
            const { token, hash } = await this.generateAppToken();
            const now = new Date().toISOString();
            const appToken = {
                id: this.generateId(),
                name: data.name,
                description: data.description,
                tokenHash: hash,
                permissions: data.permissions,
                createdBy,
                isActive: true,
                lastUsedAt: undefined,
                usageCount: 0,
                expiresAt: data.expiresAt,
                createdAt: now,
                updatedAt: now
            };
            return {
                success: true,
                token, // Return plain text token only once
                appToken
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create app token'
            };
        }
    }
    /**
     * Validate a JWT token and return authentication context
     */
    async validateToken(token) {
        try {
            const jwt = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
            const decoded = jwt.verify(token, this.config.jwtSecret);
            if (decoded.type === 'user') {
                return {
                    valid: true,
                    context: {
                        type: 'user',
                        user: {
                            id: decoded.userId,
                            username: decoded.username,
                            email: '', // Will be populated from storage
                            firstName: '', // Will be populated from storage
                            lastName: '', // Will be populated from storage
                            role: decoded.role,
                            permissions: decoded.permissions,
                            isActive: true // Will be verified from storage
                        }
                    }
                };
            }
            else if (decoded.type === 'app_token') {
                return {
                    valid: true,
                    context: {
                        type: 'app_token',
                        token: {
                            id: decoded.tokenId,
                            name: decoded.name,
                            permissions: decoded.permissions,
                            createdBy: decoded.createdBy,
                            isActive: true // Will be verified from storage
                        }
                    }
                };
            }
            return { valid: false, error: 'Invalid token type' };
        }
        catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Token validation failed'
            };
        }
    }
    /**
     * Validate an app token using the raw token string
     */
    async validateAppToken(token) {
        try {
            // Hash the provided token to compare with stored hash
            const hash = (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
            return { valid: true, hash };
        }
        catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'App token validation failed'
            };
        }
    }
    /**
     * Check if a user/token has a specific permission
     */
    hasPermission(context, permission) {
        if (context.type === 'anonymous') {
            return false;
        }
        if (context.type === 'user') {
            return context.user.permissions.includes(permission);
        }
        if (context.type === 'app_token') {
            return context.token.permissions.includes(permission);
        }
        return false;
    }
    /**
     * Check if a user/token has any of the specified permissions
     */
    hasAnyPermission(context, permissions) {
        return permissions.some(permission => this.hasPermission(context, permission));
    }
    /**
     * Check if a user/token has all of the specified permissions
     */
    hasAllPermissions(context, permissions) {
        return permissions.every(permission => this.hasPermission(context, permission));
    }
    /**
     * Get default permissions for a role
     */
    getRolePermissions(role) {
        // Import here to avoid circular dependencies
        const { ROLE_PERMISSIONS } = require('../types/user.js');
        return ROLE_PERMISSIONS[role] || [];
    }
    /**
     * Rate limiting for login attempts
     */
    isRateLimited(identifier) {
        const attempts = this.failedAttempts.get(identifier);
        if (!attempts)
            return false;
        const now = Date.now();
        const timeSinceLastAttempt = now - attempts.lastAttempt;
        // Reset if window has passed
        if (timeSinceLastAttempt > this.config.rateLimitWindow) {
            this.failedAttempts.delete(identifier);
            return false;
        }
        return attempts.count >= this.config.rateLimitAttempts;
    }
    /**
     * Record a failed login attempt
     */
    recordFailedAttempt(identifier) {
        const attempts = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
        this.failedAttempts.set(identifier, {
            count: attempts.count + 1,
            lastAttempt: Date.now()
        });
    }
    /**
     * Clear failed login attempts (on successful login)
     */
    clearFailedAttempts(identifier) {
        this.failedAttempts.delete(identifier);
    }
    /**
     * Generate a unique ID for entities
     */
    generateId() {
        return (0, node_crypto_1.randomBytes)(16).toString('hex');
    }
    /**
     * Parse time string to seconds (e.g., '1h' -> 3600)
     */
    parseTimeToSeconds(timeString) {
        const units = {
            's': 1,
            'm': 60,
            'h': 3600,
            'd': 86400,
            'w': 604800
        };
        const match = timeString.match(/^(\d+)([smhdw])$/);
        if (!match) {
            throw new Error(`Invalid time format: ${timeString}`);
        }
        const [, value, unit] = match;
        return parseInt(value, 10) * units[unit];
    }
}
exports.AuthenticationService = AuthenticationService;
/**
 * Default authentication configuration
 */
exports.DEFAULT_AUTH_CONFIG = {
    jwtSecret: process.env.TROKKY_JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: '2h', // 2 hours for access tokens
    refreshTokenExpiresIn: '7d', // 7 days for refresh tokens
    bcryptRounds: 12,
    rateLimitAttempts: 5,
    rateLimitWindow: 15 * 60 * 1000 // 15 minutes
};
