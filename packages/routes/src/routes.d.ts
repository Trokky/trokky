import type { RoutesConfig, RouteDefinition } from './types.js';
export declare class TrokkyRoutes {
    private core;
    private config;
    private routes;
    private logger;
    constructor(config: RoutesConfig);
    private initializeRoutes;
    private addRoute;
    getRoutes(): RouteDefinition[];
    getApiRoutes(): RouteDefinition[];
    getStaticRoutes(): RouteDefinition[];
    private isStaticRoute;
    findRoute(method: string, path: string): RouteDefinition | undefined;
    private matchesPattern;
    extractParams(pattern: string, path: string): Record<string, string>;
    private validateAuthentication;
    private validateMediaFiles;
    private listCollections;
    private listDocuments;
    private createDocument;
    private getDocument;
    private updateDocument;
    private deleteDocument;
    private getCollectionStats;
    private listMedia;
    private uploadMedia;
    private getMedia;
    private deleteMedia;
    private regenerateVariants;
    private serveMediaFile;
    private serveMediaVariant;
    private checkSlugUniqueness;
    private healthCheck;
    private handleCors;
    private initializeStaticRoutes;
    private createStaticHandler;
    private getContentType;
    private listUsers;
    private createUser;
    private getUser;
    private updateUser;
    private deleteUser;
    private getUserByUsername;
    private getUserByEmail;
    private login;
    private logout;
    private validateToken;
    private validateAdminAccess;
    private logAdminAccess;
    private successResponse;
    private errorResponse;
    private buildCorsHeaders;
    private updateMedia;
    private refreshToken;
    private listTokens;
    private createToken;
    private getToken;
    private updateToken;
    private deleteToken;
    private getSchema;
    private getStructure;
    /**
     * Get studio configuration from trokky.config
     */
    private getStudioConfig;
    private getCustomStructureFunction;
    private getCurrentUser;
    private buildDefaultStructure;
    private shouldIncludeSchemaInStructure;
    private formatSchemaTitle;
    private getSchemaIcon;
    private getSearchableFields;
    /**
     * Attempt to auto-create a singleton document if it matches known singleton patterns
     */
    private tryAutoCreateSingleton;
    /**
     * Get default data for specific singleton types
     */
    private getDefaultSingletonData;
}
//# sourceMappingURL=routes.d.ts.map