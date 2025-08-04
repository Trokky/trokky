/**
 * Studio Integration for TrokkyCore
 *
 * Provides integrated Studio functionality directly in the CMS core,
 * eliminating the need for separate Studio setup and HTTP discovery.
 */
import type { TrokkyCore } from '../core/engine.js';
export interface StudioConfig {
    enabled?: boolean;
    path?: string;
    branding?: {
        title?: string;
        logo?: string;
        theme?: 'light' | 'dark' | 'system';
    };
    structure?: unknown;
    config?: {
        pageSize?: number;
        enableDrafts?: boolean;
        enableVersioning?: boolean;
    };
    customFields?: unknown[];
    getHTML?: (config: any, studioPath: string) => string;
    getAsset?: (assetPath: string) => {
        content: Buffer | Uint8Array;
        contentType: string;
    } | null;
}
export interface StudioRoute {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    handler: (request: StudioRequest) => Promise<StudioResponse>;
}
export interface StudioRequest {
    method: string;
    url: string;
    path: string;
    query: Record<string, string | string[] | undefined>;
    params: Record<string, string>;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
    files?: File[];
}
export interface StudioResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}
export declare class StudioIntegration {
    private core;
    private config;
    private routes;
    private logger;
    constructor(core: TrokkyCore, config?: StudioConfig);
    private initializeRoutes;
    private addRoute;
    getRoutes(): StudioRoute[];
    findRoute(method: string, path: string): StudioRoute | undefined;
    private calculateSpecificity;
    private matchesPattern;
    extractParams(pattern: string, path: string): Record<string, string>;
    private serveStudioHTML;
    private serveStudioAssets;
    private getSchemas;
    private getSchema;
    private errorResponse;
}
//# sourceMappingURL=integration.d.ts.map