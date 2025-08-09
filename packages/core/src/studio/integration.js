/**
 * Studio Integration for TrokkyCore
 *
 * Provides integrated Studio functionality directly in the CMS core,
 * eliminating the need for separate Studio setup and HTTP discovery.
 */
import { createLogger } from '../utils/logger.js';
export class StudioIntegration {
    core;
    config;
    routes = new Map();
    logger = createLogger('core', 'StudioIntegration');
    constructor(core, config = {}) {
        this.core = core;
        this.config = {
            enabled: true,
            path: '/studio',
            ...config
        };
        if (this.config.enabled) {
            this.initializeRoutes();
        }
    }
    initializeRoutes() {
        const studioPath = this.config.path || '/studio';
        this.logger.debug('Initializing Studio routes', { studioPath });
        // Studio assets (must be before catch-all)
        this.addRoute('GET', `${studioPath}/assets/*`, this.serveStudioAssets.bind(this));
        // Studio HTML page
        this.addRoute('GET', studioPath, this.serveStudioHTML.bind(this));
        // Schema metadata for Studio
        this.addRoute('GET', '/api/schemas', this.getSchemas.bind(this));
        this.addRoute('GET', '/api/schemas/:schemaName', this.getSchema.bind(this));
        // Catch-all for Studio SPA routing (must be last)
        this.addRoute('GET', `${studioPath}/*`, this.serveStudioHTML.bind(this));
        this.logger.info('Studio routes initialized', {
            count: this.routes.size,
            routes: Array.from(this.routes.keys())
        });
        // Test specificity calculation for debugging
        const testPaths = [`${studioPath}/assets/*`, `${studioPath}/*`];
        for (const path of testPaths) {
            const specificity = this.calculateSpecificity(path);
            this.logger.debug('Route specificity', { path, specificity });
        }
    }
    addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        this.logger.debug('Adding Studio route', { method, path });
        this.routes.set(key, { method, path, handler });
    }
    getRoutes() {
        return Array.from(this.routes.values());
    }
    findRoute(method, path) {
        // First try exact match
        const exactKey = `${method}:${path}`;
        if (this.routes.has(exactKey)) {
            return this.routes.get(exactKey);
        }
        // Then try pattern matching, prioritizing more specific routes
        const matchingRoutes = [];
        for (const [key, route] of this.routes.entries()) {
            if (key.startsWith(`${method}:`)) {
                const routePath = route.path;
                if (this.matchesPattern(routePath, path)) {
                    const specificity = this.calculateSpecificity(routePath);
                    matchingRoutes.push({ route, specificity });
                }
            }
        }
        // Return the most specific matching route
        if (matchingRoutes.length > 0) {
            matchingRoutes.sort((a, b) => b.specificity - a.specificity);
            this.logger.debug('Route matching result', {
                path,
                matches: matchingRoutes.map(m => ({ path: m.route.path, specificity: m.specificity })),
                selected: matchingRoutes[0].route.path
            });
            return matchingRoutes[0].route;
        }
        return undefined;
    }
    calculateSpecificity(pattern) {
        let score = 0;
        const segments = pattern.split('/').filter(s => s !== '');
        // More segments = more specific
        score += segments.length * 10;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (segment && !segment.startsWith(':') && segment !== '*') {
                // Literal segments are most specific
                score += 100;
                // Segments deeper in the path are more specific
                score += (i + 1) * 10;
            }
            else if (segment.startsWith(':')) {
                // Parameter segments are moderately specific
                score += 50;
            }
            else if (segment === '*') {
                // Wildcard segments are least specific
                score += 1;
            }
        }
        // Penalize catch-all patterns
        if (pattern.endsWith('/*')) {
            score -= 50;
        }
        return score;
    }
    matchesPattern(pattern, path) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        if (patternParts.length !== pathParts.length) {
            if (pattern.endsWith('/*')) {
                const basePattern = pattern.slice(0, -2);
                return path.startsWith(basePattern);
            }
            return false;
        }
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];
            if (patternPart.startsWith(':')) {
                continue;
            }
            if (patternPart !== pathPart) {
                return false;
            }
        }
        return true;
    }
    extractParams(pattern, path) {
        const params = {};
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];
            if (patternPart.startsWith(':')) {
                const paramName = patternPart.slice(1);
                params[paramName] = decodeURIComponent(pathPart || '');
            }
        }
        return params;
    }
    // Studio route handlers
    async serveStudioHTML(request) {
        try {
            const schemas = this.core.getAllSchemas();
            const runtimeConfig = {
                mode: 'integrated',
                apiBasePath: '/api',
                schemas,
                branding: this.config.branding || { title: 'Trokky Studio' },
                structure: this.config.structure || null,
                config: this.config.config || {},
                customFields: this.config.customFields || []
            };
            const studioPath = this.config.path || '/studio';
            let html;
            if (this.config.getHTML) {
                html = this.config.getHTML(runtimeConfig, studioPath);
            }
            else {
                html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.branding?.title || 'Trokky Studio'}</title>
    <script>
      window.TROKKY_INTEGRATED_CONFIG = ${JSON.stringify(runtimeConfig)};
    </script>
</head>
<body>
    <div id="root">
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif;">
            <div style="text-align: center;">
                <h1>${this.config.branding?.title || 'Trokky Studio'}</h1>
                <p>Studio HTML generator not provided. Please configure studio.getHTML callback.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
            }
            return {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }
        catch (error) {
            return this.errorResponse(error);
        }
    }
    async serveStudioAssets(request) {
        try {
            const assetPath = request.path.replace(/^.*\/assets\//, '');
            this.logger.debug('Serving Studio asset', {
                requestPath: request.path,
                extractedAssetPath: assetPath,
                hasGetAsset: !!this.config.getAsset
            });
            if (this.config.getAsset) {
                const result = this.config.getAsset(assetPath);
                this.logger.debug('Asset result', {
                    assetPath,
                    found: !!result,
                    contentType: result?.contentType,
                    contentLength: result?.content?.length
                });
                if (!result) {
                    return {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                        body: { error: 'Asset not found' }
                    };
                }
                return {
                    status: 200,
                    headers: {
                        'Content-Type': result.contentType,
                        'Cache-Control': 'public, max-age=31536000'
                    },
                    body: result.content
                };
            }
            else {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Studio asset getter not configured' }
                };
            }
        }
        catch (error) {
            this.logger.error('Error serving Studio asset', { error: error instanceof Error ? error.message : String(error) });
            return this.errorResponse(error);
        }
    }
    async getSchemas(request) {
        try {
            const schemas = this.core.getAllSchemas();
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    success: true,
                    data: {
                        schemas: schemas.map(schema => ({
                            name: schema.name,
                            title: schema.title || schema.name,
                            type: schema.type || 'document',
                            description: schema.description
                        }))
                    }
                }
            };
        }
        catch (error) {
            return this.errorResponse(error);
        }
    }
    async getSchema(request) {
        try {
            const { schemaName } = request.params;
            const schemas = this.core.getAllSchemas();
            const schema = schemas.find(s => s.name === schemaName);
            if (!schema) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: false,
                        error: { code: 'NOT_FOUND', message: `Schema '${schemaName}' not found` }
                    }
                };
            }
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { success: true, data: { schema } }
            };
        }
        catch (error) {
            return this.errorResponse(error);
        }
    }
    errorResponse(error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: false,
                error: { code: 'INTERNAL_ERROR', message }
            }
        };
    }
}
