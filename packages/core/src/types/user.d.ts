/**
 * System user types for CMS authentication and authorization
 * These are internal system entities, separate from user-defined content schemas
 */
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissions: Permission[];
    isActive: boolean;
    profileImage?: string;
    preferences?: UserPreferences;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
}
export type UserRole = 'admin' | 'editor' | 'author' | 'viewer';
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export type Permission = 'content:read' | 'content:write' | 'content:delete' | 'content:publish' | 'media:read' | 'media:upload' | 'media:edit' | 'media:delete' | 'users:read' | 'users:write' | 'users:delete' | 'users:invite' | 'settings:read' | 'settings:write' | 'studio:access' | 'tokens:read' | 'tokens:write' | 'tokens:delete';
export interface UserPreferences {
    theme?: 'light' | 'dark';
    language?: string;
    timezone?: string;
    [key: string]: unknown;
}
export interface CreateUserData {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissions?: Permission[];
    isActive?: boolean;
    profileImage?: string;
    preferences?: UserPreferences;
}
export interface UpdateUserData {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    permissions?: Permission[];
    isActive?: boolean;
    profileImage?: string;
    preferences?: UserPreferences;
    lastLoginAt?: string;
}
export interface UserListOptions {
    role?: UserRole;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}
export interface LoginCredentials {
    username: string;
    password: string;
}
export interface UserSession {
    userId: string;
    username: string;
    role: UserRole;
    permissions: Permission[];
    loginAt: string;
    expiresAt?: string;
}
export interface AppToken {
    id: string;
    name: string;
    description?: string;
    tokenHash: string;
    permissions: Permission[];
    createdBy: string;
    isActive: boolean;
    lastUsedAt?: string;
    usageCount?: number;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateAppTokenData {
    name: string;
    description?: string;
    permissions: Permission[];
    expiresAt?: string;
}
export interface UpdateAppTokenData {
    name?: string;
    description?: string;
    permissions?: Permission[];
    isActive?: boolean;
    expiresAt?: string;
}
export interface AppTokenListOptions {
    createdBy?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}
export interface AuthenticatedUser {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissions: Permission[];
    isActive: boolean;
}
export interface AuthenticatedAppToken {
    id: string;
    name: string;
    permissions: Permission[];
    createdBy: string;
    isActive: boolean;
}
export type AuthContext = {
    type: 'user';
    user: AuthenticatedUser;
} | {
    type: 'app_token';
    token: AuthenticatedAppToken;
} | {
    type: 'anonymous';
};
export interface UserTokenPayload {
    type: 'user';
    userId: string;
    username: string;
    role: UserRole;
    permissions: Permission[];
    iat: number;
    exp: number;
}
export interface AppTokenPayload {
    type: 'app_token';
    tokenId: string;
    name: string;
    permissions: Permission[];
    createdBy: string;
    iat: number;
    exp?: number;
}
//# sourceMappingURL=user.d.ts.map