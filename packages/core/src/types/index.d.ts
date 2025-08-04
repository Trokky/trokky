import { z } from 'zod';
import type { User, UserListOptions, AppToken, AppTokenListOptions } from './user.js';
export interface Document {
    id: string;
    _collection: string;
    _createdAt: Date;
    _updatedAt: Date;
    _revision?: number;
    _status?: 'draft' | 'published';
}
export interface DocumentWithContent extends Document {
    [key: string]: unknown;
}
export type DocumentData = Omit<Document, 'id' | '_collection' | '_createdAt' | '_updatedAt' | '_revision' | '_status'>;
export declare const LegacyFieldTypeSchema: z.ZodEnum<["string", "number", "boolean", "date", "array", "object", "reference", "media", "slug"]>;
export type LegacyFieldType = z.infer<typeof LegacyFieldTypeSchema>;
export interface LegacyFieldDefinition {
    type: LegacyFieldType;
    required?: boolean;
    description?: string;
    validation?: Record<string, unknown>;
    options?: Record<string, unknown>;
    items?: LegacyFieldDefinition;
    properties?: Record<string, LegacyFieldDefinition>;
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
export declare const LegacyFieldDefinitionSchema: z.ZodType<LegacyFieldDefinition>;
export declare const ContentSchemaSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["document", "singleton"]>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    singleton: z.ZodOptional<z.ZodBoolean>;
    fields: z.ZodRecord<z.ZodString, z.ZodType<LegacyFieldDefinition, z.ZodTypeDef, LegacyFieldDefinition>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "document" | "singleton";
    fields: Record<string, LegacyFieldDefinition>;
    description?: string | undefined;
    singleton?: boolean | undefined;
    title?: string | undefined;
}, {
    name: string;
    type: "document" | "singleton";
    fields: Record<string, LegacyFieldDefinition>;
    description?: string | undefined;
    singleton?: boolean | undefined;
    title?: string | undefined;
}>;
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
    url: string;
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
    saveDocument(collection: string, id: string, data: DocumentData): Promise<Document>;
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
    };
    security?: {
        validateInput?: boolean;
        rateLimitEnabled?: boolean;
    };
}
export type { User, UserRole, Permission, UserPreferences, CreateUserData, UpdateUserData, UserListOptions, LoginCredentials, UserSession, AppToken, AppTokenListOptions, CreateAppTokenData, UpdateAppTokenData, AuthContext, AuthenticatedUser, AuthenticatedAppToken } from './user.js';
export { ROLE_PERMISSIONS } from './user.js';
//# sourceMappingURL=index.d.ts.map