import { ListOptions } from '../types/index.js';
export declare class SecurityValidator {
    private static readonly COLLECTION_NAME_REGEX;
    private static readonly ID_REGEX;
    private static readonly MAX_COLLECTION_NAME_LENGTH;
    private static readonly MAX_ID_LENGTH;
    private static readonly MAX_LIMIT;
    private static readonly MAX_SORT_FIELDS;
    static validateCollectionName(name: string): void;
    static validateDocumentId(id: string): void;
    static sanitizeListOptions(options?: ListOptions): ListOptions | undefined;
    private static validateSortField;
    static sanitizeFilter(filter: unknown): Record<string, unknown>;
    private static sanitizeFilterValue;
    static validateDocumentData(data: unknown): void;
    static validateUsername(username: string): void;
    static validateEmail(email: string): void;
}
//# sourceMappingURL=validation.d.ts.map