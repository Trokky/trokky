import { z } from 'zod';
import type { FieldRegistry, FieldType } from '@trokky/types';
import type { User, UserListOptions, AppToken, AppTokenListOptions } from './user.js';
export declare const AUDIT_ACTOR_TYPES: {
    readonly USER: "user";
    readonly API: "api";
    readonly SYSTEM: "system";
    readonly WEBHOOK: "webhook";
};
export type AuditActorType = typeof AUDIT_ACTOR_TYPES[keyof typeof AUDIT_ACTOR_TYPES];
export interface AuditContext {
    userId: string;
    userType: AuditActorType;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
}
export declare const AUDIT_OPERATIONS: {
    readonly CREATE: "create";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly PUBLISH: "publish";
    readonly UNPUBLISH: "unpublish";
    readonly RESTORE: "restore";
};
export type AuditOperation = typeof AUDIT_OPERATIONS[keyof typeof AUDIT_OPERATIONS];
export interface AuditLog {
    id: string;
    documentId: string;
    collection: string;
    operation: AuditOperation;
    actorId: string;
    actorType: AuditActorType;
    actorUsername?: string;
    changes?: {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        fields?: string[];
    };
    timestamp: Date;
    revision: number;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
}
export interface Document {
    id: string;
    _collection: string;
    _createdAt: Date;
    _updatedAt: Date;
    _revision?: number;
    _status?: 'draft' | 'published';
    _createdBy?: string;
    _updatedBy?: string;
    _createdByType?: AuditActorType;
    _updatedByType?: AuditActorType;
}
export interface DocumentWithContent extends Document {
    [key: string]: unknown;
}
export type DocumentData = Omit<Document, 'id' | '_collection' | '_createdAt' | '_updatedAt' | '_revision' | '_status'>;
export declare function setFieldRegistry(registry: FieldRegistry): void;
export declare function getRegisteredFieldTypes(): string[];
export declare const FieldTypeSchema: z.ZodString;
export type { FieldType };
export interface FieldDefinition {
    type: FieldType;
    required?: boolean;
    description?: string;
    validation?: Record<string, unknown>;
    options?: Record<string, unknown>;
    of?: FieldDefinition;
    fields?: Record<string, FieldDefinition> | Array<{
        name: string;
        type: string;
        title: string;
        description?: string;
        required?: boolean;
        validation?: any;
        options?: any;
        default?: any;
        fields?: any;
        to?: any;
        of?: any;
    }>;
    to?: string;
    collection?: string;
    source?: string | string[];
    autoGenerate?: boolean;
    unique?: boolean;
    maxLength?: number;
    minLength?: number;
    allowEmpty?: boolean;
    readOnly?: boolean;
    preserveCase?: boolean;
    allowedChars?: string;
    prefix?: string;
    suffix?: string;
}
export declare const FieldDefinitionSchema: z.ZodSchema<any>;
export declare const ContentSchemaSchema: z.ZodSchema<any>;
export type ContentSchema = z.infer<typeof ContentSchemaSchema>;
export interface ListOptions {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
    sort?: string | string[];
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationErrorDetail[];
}
export interface ValidationErrorDetail {
    field: string;
    message: string;
    code: string;
}
export interface MediaFile {
    id: string;
    url?: string;
    filename: string;
    contentType: string;
    size: number;
    metadata?: Record<string, unknown>;
    _createdAt: Date;
}
export interface MediaMetadata {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    extension: string;
}
export interface Migration {
    version: string;
    description: string;
    up: () => Promise<void>;
    down: () => Promise<void>;
}
export interface StorageAdapter {
    getDocument(collection: string, id: string): Promise<Document | null>;
    saveDocument(collection: string, id: string, data: DocumentData, auditContext?: AuditContext): Promise<Document>;
    listDocuments(collection: string, options?: ListOptions): Promise<Document[]>;
    deleteDocument(collection: string, id: string): Promise<void>;
    uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile>;
    getFile(id: string): Promise<MediaFile | null>;
    updateFile?(id: string, metadata: Record<string, any>): Promise<MediaFile>;
    getFileContent(id: string): Promise<ArrayBuffer | null>;
    listMedia?(options?: {
        limit?: number;
        offset?: number;
    }): Promise<MediaFile[]>;
    deleteFile(id: string): Promise<void>;
    saveVariantFile?(parentId: string, variantName: string, buffer: Buffer, format: string): Promise<string>;
    getVariantContent?(parentId: string, variantName: string): Promise<ArrayBuffer | null>;
    getVariantUrl?(parentId: string, variantName: string): string;
    deleteVariantFiles?(parentId: string): Promise<void>;
    getUser?(id: string): Promise<User | null>;
    saveUser?(id: string, userData: Partial<User>): Promise<User>;
    listUsers?(options?: UserListOptions): Promise<User[]>;
    deleteUser?(id: string): Promise<void>;
    getUserByUsername?(username: string): Promise<User | null>;
    getUserByEmail?(email: string): Promise<User | null>;
    getAppToken?(id: string): Promise<AppToken | null>;
    saveAppToken?(id: string, tokenData: Partial<AppToken>): Promise<AppToken>;
    listAppTokens?(options?: AppTokenListOptions): Promise<AppToken[]>;
    deleteAppToken?(id: string): Promise<void>;
    getAppTokenByHash?(hash: string): Promise<AppToken | null>;
    healthCheck(): Promise<boolean>;
    migrate(migrations: Migration[]): Promise<void>;
}
export interface StorageAdapterOptions {
    [key: string]: string | number | boolean | undefined;
}
export interface ApiConfig {
    basePath?: string;
    cors?: boolean;
    rateLimit?: {
        windowMs?: number;
        maxRequests?: number;
    };
}
export interface TrokkyConfig {
    storage: {
        adapter: string;
        options: StorageAdapterOptions;
    };
    schemas: string | ContentSchema[];
    api?: ApiConfig;
    media?: {
        imageProcessor?: 'none' | 'sharp' | 'cloudflare-images' | 'imagekit' | 'imgix' | 'custom';
        imageVariants?: Array<{
            name: string;
            width?: number;
            height?: number;
            format?: 'jpeg' | 'png' | 'webp' | 'avif';
            quality?: number;
            fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
        }>;
        imageProcessorOptions?: Record<string, unknown>;
        validation?: {
            maxFileSize?: number;
            maxFiles?: number;
            allowedTypes?: string[];
            allowedExtensions?: string[];
            forbiddenExtensions?: string[];
        };
    };
    features?: {
        autoThumbnail?: {
            enabled?: boolean;
            fieldName?: string;
            skipSingletons?: boolean;
            skipSchemas?: string[];
            maxFileSize?: number;
            allowedTypes?: string[];
        };
        autoSlug?: {
            enabled?: boolean;
            sourceFields?: string[];
            unique?: boolean;
        };
    };
    security?: {
        validateInput?: boolean;
        rateLimitEnabled?: boolean;
    };
}
export type { User, UserRole, Permission, UserPreferences, CreateUserData, UpdateUserData, UserListOptions, LoginCredentials, UserSession, AppToken, AppTokenListOptions, CreateAppTokenData, UpdateAppTokenData, AuthContext, AuthenticatedUser, AuthenticatedAppToken } from './user.js';
export { ROLE_PERMISSIONS } from './user.js';
export type { MediaAssetReference, MediaFieldValue, MediaType, MediaAsset, MediaBrowserConfig } from '@trokky/types';
export type { DataStorageAdapter, MediaStorageAdapter, DataTransaction, MediaListOptions, MediaVariant, SplitStorageConfig, TrokkyStorageAdapters, WebhookListOptions, SettingsConfig } from './storage-adapters.js';
//# sourceMappingURL=index.d.ts.map