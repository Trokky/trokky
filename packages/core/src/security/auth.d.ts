/**
 * Authentication and Authorization Service
 *
 * Provides secure user authentication with JWT tokens and app token management.
 * Supports multiple authentication methods:
 * - User JWT sessions (for Studio access)
 * - App tokens (for API integrations)
 * - Service tokens (for internal communication)
 */
import type { User, AppToken, AuthContext, Permission, UserRole, CreateAppTokenData, AuthenticatedUser } from '../types/user.js';
export interface AuthConfig {
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    bcryptRounds: number;
    rateLimitAttempts: number;
    rateLimitWindow: number;
}
export interface LoginResult {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    user?: AuthenticatedUser;
    error?: string;
}
export interface TokenValidationResult {
    valid: boolean;
    context?: AuthContext;
    error?: string;
}
export interface AppTokenCreationResult {
    success: boolean;
    token?: string;
    appToken?: AppToken;
    error?: string;
}
export declare class AuthenticationService {
    private config;
    private failedAttempts;
    constructor(config: AuthConfig);
    /**
     * Hash a password using bcrypt-compatible algorithm
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verify a password against its hash
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Generate a secure JWT token for user authentication
     */
    generateUserToken(user: User): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Generate a secure app token for API access
     */
    generateAppToken(): Promise<{
        token: string;
        hash: string;
    }>;
    /**
     * Create an app token with specified permissions
     */
    createAppToken(data: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult>;
    /**
     * Validate a JWT token and return authentication context
     */
    validateToken(token: string): Promise<TokenValidationResult>;
    /**
     * Validate an app token using the raw token string
     */
    validateAppToken(token: string): Promise<{
        valid: boolean;
        hash?: string;
        error?: string;
    }>;
    /**
     * Check if a user/token has a specific permission
     */
    hasPermission(context: AuthContext, permission: Permission): boolean;
    /**
     * Check if a user/token has any of the specified permissions
     */
    hasAnyPermission(context: AuthContext, permissions: Permission[]): boolean;
    /**
     * Check if a user/token has all of the specified permissions
     */
    hasAllPermissions(context: AuthContext, permissions: Permission[]): boolean;
    /**
     * Get default permissions for a role
     */
    getRolePermissions(role: UserRole): Permission[];
    /**
     * Rate limiting for login attempts
     */
    isRateLimited(identifier: string): boolean;
    /**
     * Record a failed login attempt
     */
    recordFailedAttempt(identifier: string): void;
    /**
     * Clear failed login attempts (on successful login)
     */
    clearFailedAttempts(identifier: string): void;
    /**
     * Generate a unique ID for entities
     */
    private generateId;
    /**
     * Parse time string to seconds (e.g., '1h' -> 3600)
     */
    private parseTimeToSeconds;
}
/**
 * Default authentication configuration
 */
export declare const DEFAULT_AUTH_CONFIG: AuthConfig;
//# sourceMappingURL=auth.d.ts.map