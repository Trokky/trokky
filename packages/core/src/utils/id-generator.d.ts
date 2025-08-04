export interface IdGeneratorOptions {
    prefix?: string;
    length?: number;
    includeTimestamp?: boolean;
}
export declare class IdGenerator {
    private counter;
    private readonly instanceId;
    private readonly crypto;
    constructor();
    generate(options?: IdGeneratorOptions): string;
    generateUUID(): string;
    validateId(id: string): boolean;
    reset(): void;
}
//# sourceMappingURL=id-generator.d.ts.map