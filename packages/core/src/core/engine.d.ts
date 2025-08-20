import { type CryptoAdapter, type CryptoAdapterOptions } from '../crypto/adapter.js';
import { SchemaRegistry } from '../schema/registry.js';
import { DocumentValidator } from '../validation/validator.js';
import { RateLimiter } from '../security/rate-limiter.js';
import { IdGenerator } from '../utils/id-generator.js';
import { type ImageProcessor, type ImageProcessorConfig } from '../media/image-processor.js';
import { TrokkyEventBus, type EventBusConfig } from '../events/index.js';
import { TrokkyConfig, StorageAdapter, DataStorageAdapter, MediaStorageAdapter, TrokkyStorageAdapters, Document, DocumentData, ListOptions, MediaFile, ContentSchema, ValidationResult, User, CreateUserData, UpdateUserData, UserListOptions, UserSession, AppToken, AppTokenListOptions, CreateAppTokenData, AuditContext, AuditLog } from '../types/index.js';
import type { AppTokenCreationResult } from '../security/auth.js';
export interface TrokkyCoreOptions {
    schemaRegistry?: SchemaRegistry;
    validator?: DocumentValidator;
    idGenerator?: IdGenerator;
    rateLimiter?: RateLimiter;
    enableSecurity?: boolean;
    setupAdminFromEnv?: boolean;
    jwtSecret?: string;
    auditLogger?: (event: AuditEvent) => void;
    cryptoAdapter?: CryptoAdapter;
    cryptoOptions?: CryptoAdapterOptions;
    imageProcessor?: ImageProcessor;
    imageProcessorConfig?: ImageProcessorConfig;
    validateAdapters?: boolean;
    allowPartialAdapters?: boolean;
    eventBus?: TrokkyEventBus;
    eventBusConfig?: EventBusConfig;
    enableEvents?: boolean;
}
export interface AuditEvent {
    type: 'user_created' | 'user_updated' | 'user_deleted' | 'user_login' | 'user_logout' | 'admin_access' | 'app_token_deleted';
    userId?: string;
    targetUserId?: string;
    targetTokenId?: string;
    username?: string;
    tokenName?: string;
    action: string;
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    details?: Record<string, unknown>;
}
export declare class TrokkyCore {
    private dataStorage;
    private mediaStorage;
    private storage?;
    private schemas;
    private validator;
    private idGenerator;
    private rateLimiter?;
    private securityEnabled;
    private options;
    private jwtSecret;
    private config;
    private auditLogger?;
    private cryptoAdapter;
    private imageProcessor;
    private imageProcessorConfig;
    private logger;
    private auditLog;
    private eventBus;
    private eventsEnabled;
    constructor(config: TrokkyConfig, storageAdapter: StorageAdapter, options?: TrokkyCoreOptions);
    constructor(config: TrokkyConfig, storageAdapters: TrokkyStorageAdapters, options?: TrokkyCoreOptions);
    private isTrokkyStorageAdapters;
    private createDataAdapterWrapper;
    private createMediaAdapterWrapper;
    private validateStorageAdapters;
    getEventBus(): TrokkyEventBus;
    init(): Promise<void>;
    private createAuditLog;
    getDocument<T extends Record<string, unknown> = Record<string, unknown>>(collection: string, id: string): Promise<(Document & T) | null>;
    saveDocument<T extends Record<string, unknown> = Record<string, unknown>>(collection: string, data: DocumentData & T & {
        id?: string;
    }, auditContext?: AuditContext): Promise<Document & T>;
    listDocuments<T extends Record<string, unknown> = Record<string, unknown>>(collection: string, options?: ListOptions): Promise<(Document & T)[]>;
    deleteDocument(collection: string, id: string, auditContext?: AuditContext): Promise<void>;
    /**
     * Get audit logs for a specific document
     */
    getDocumentAuditLogs(documentId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<AuditLog[]>;
    /**
     * Get audit logs for a collection
     */
    getCollectionAuditLogs(collection: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<AuditLog[]>;
    /**
     * Get audit logs for a specific actor
     */
    getActorAuditLogs(actorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<AuditLog[]>;
    uploadMedia(file: File): Promise<MediaFile>;
    getMedia(id: string): Promise<MediaFile | null>;
    updateMedia(id: string, metadata: Record<string, any>): Promise<MediaFile>;
    getMediaContent(id: string): Promise<ArrayBuffer | null>;
    listMedia(options?: {
        limit?: number;
        offset?: number;
    }): Promise<MediaFile[]>;
    deleteMedia(id: string): Promise<void>;
    regenerateMediaVariants(id: string): Promise<MediaFile>;
    getSchema(name: string): ContentSchema | null;
    getAllSchemas(): ContentSchema[];
    validateDocument(collection: string, data: unknown): ValidationResult;
    getImageUrl(imageId: string, variantName?: string): string;
    getImageProcessor(): Promise<ImageProcessor>;
    /**
     * Get storage adapter (legacy unified adapter)
     * @deprecated Use getDataStorageAdapter() and getMediaStorageAdapter() instead
     */
    getStorageAdapter(): StorageAdapter | null;
    /**
     * Get data storage adapter
     */
    getDataStorageAdapter(): DataStorageAdapter;
    /**
     * Get media storage adapter
     */
    getMediaStorageAdapter(): MediaStorageAdapter;
    /**
     * Get both storage adapters
     */
    getStorageAdapters(): TrokkyStorageAdapters;
    healthCheck(): Promise<boolean>;
    private validateAndSanitizeMediaFile;
    private sanitizeFilename;
    private getFileExtension;
    createUser(userData: CreateUserData): Promise<User>;
    getUser(id: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    updateUser(id: string, userData: UpdateUserData): Promise<User>;
    listUsers(options?: UserListOptions): Promise<User[]>;
    deleteUser(id: string): Promise<void>;
    listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]>;
    createAppToken(tokenData: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult>;
    getAppToken(id: string): Promise<AppToken | null>;
    validateAppToken(token: string): Promise<{
        valid: boolean;
        appToken?: AppToken;
        error?: string;
    }>;
    deleteAppToken(id: string): Promise<void>;
    verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
    private hashPassword;
    private getDefaultPermissions;
    private checkWeakPassword;
    generateAuthToken(user: User, expiresIn?: string): Promise<string>;
    verifyAuthToken(token: string): Promise<UserSession | null>;
    /**
     * Unified token validation that handles both JWT and API tokens
     * Returns a consistent UserSession interface for both token types
     */
    verifyAnyToken(token: string): Promise<UserSession | null>;
    authenticateUser(username: string, password: string, options?: {
        rememberMe?: boolean;
    }): Promise<{
        user: User;
        token: string;
        refreshToken: string;
    } | null>;
    refreshAuthToken(refreshToken: string): Promise<{
        token: string;
        refreshToken: string;
        user: User;
        expiresAt: string;
    } | null>;
    private generateSecureSecret;
    logAuditEvent(event: AuditEvent): void;
    setupAdminFromEnv(): Promise<User | null>;
    cleanup(): void;
}
//# sourceMappingURL=engine.d.ts.map