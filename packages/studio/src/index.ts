/**
 * @trokky/studio - Trokky CMS Studio
 * 
 * A clean, maintainable Studio for Trokky CMS that works with API routers.
 */

import type { Request, Response } from 'express';
import { createStudioLogger } from './utils/logger.js';

interface StudioConfig {
  /** API router for Studio to connect to (from @trokky/express or any Trokky API integration) */
  apiRouter: any;
  
  /** Mount point for Studio (default: '/studio') */
  mount?: string;
  
  /** Enable authentication */
  auth?: boolean;
  
  /** Studio branding configuration */
  branding?: {
    title?: string;
    logo?: string;
    theme?: 'light' | 'dark' | 'system';
  };
  
  /** Custom structure configuration */
  structure?: any;
  
  /** Custom field types to register */
  customFields?: any[];
  
  /** Additional Studio configuration */
  config?: {
    pageSize?: number;
    enableDrafts?: boolean;
    enableVersioning?: boolean;
  };
  
  /** Session management configuration */
  sessionConfig?: {
    /** Auto-refresh token buffer in milliseconds (default: 30000) */
    refreshBufferMs?: number;
    /** Warning display buffer in milliseconds (default: 90000) */
    warningBufferMs?: number;
    /** Session check interval in milliseconds (default: 5000) */
    checkIntervalMs?: number;
    /** Default session timeout in milliseconds (default: 2 hours) */
    defaultTimeoutMs?: number;
    /** Extended session timeout for "Remember Me" in milliseconds (default: 7 days) */
    extendedTimeoutMs?: number;
    /** Inactivity timeout in milliseconds (default: 30 minutes) */
    inactivityTimeoutMs?: number;
  };
}

interface StudioMiddleware {
  /** Express router containing Studio routes */
  router: any;
}

/**
 * Create a Trokky Studio middleware
 * 
 * @example
 * ```typescript
 * import { createStudio } from '@trokky/studio'
 * 
 * const studio = createStudio({
 *   apiRouter: myApiRouter,
 *   schemas: cms.getAllSchemas(),
 *   branding: { title: 'My CMS Admin' }
 * })
 * 
 * app.use('/studio', studio.router)
 * ```
 */
export async function createStudio(config: StudioConfig): Promise<StudioMiddleware> {
  const logger = createStudioLogger('Studio');
  
  // Validate configuration
  if (!config.apiRouter) {
    throw new Error('apiRouter is required in config');
  }
  
  // Note: Schemas are now fetched from /api/collections endpoint
  
  // Import Express synchronously for Node.js environment
  let router: any;
  
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const express = require('express');
    router = express.Router();
  } catch (e) {
    console.error('[ERROR] Failed to import Express:', e);
    throw new Error('Express is required for Studio but could not be imported');
  }
  
  logger.info('Creating Studio', {
    mount: config.mount || '/studio',
    auth: config.auth || false,
    customFields: config.customFields?.length || 0
  });

  // Serve Studio static assets
  router.get('/', serveStudioHTML(config));
  router.get('/assets/*', serveStudioAssets());
  
  // Note: API router is mounted at main server level (/api), not here
  // router.use('/api', config.apiRouter); // Removed - API is at server root level
  
  // Catch-all route for SPA routing - must be last  
  router.get('*', serveStudioHTML(config));
  
  return { router };
}

/**
 * Serve the Studio HTML with injected configuration
 */
function serveStudioHTML(config: StudioConfig) {
  return async (_req: Request, res: Response) => {
    try {
      // Get Studio HTML template (only works in Node.js)
      let html: string;
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const url = require('url');
        const path = require('path');
        const fs = require('fs');
        const currentFile = url.fileURLToPath(import.meta.url);
        const currentDir = path.dirname(currentFile);
        
        // Check if we're running from TypeScript source or compiled dist
        const isTypeScript = currentFile.includes('/src/');
        const htmlPath = isTypeScript 
          ? path.join(currentDir, '../dist/index.html')  // From src/ to dist/
          : path.join(currentDir, 'index.html');         // Already in dist/
        html = fs.readFileSync(htmlPath, 'utf-8');
      } catch (e: unknown) {
        console.error('[ERROR] Failed to read Studio HTML:', (e as Error).message);
        // Provide basic HTML template
        html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trokky Studio</title>
</head>
<body>
    <div id="root">
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif;">
            <div style="text-align: center;">
                <h1>Trokky Studio</h1>
                <p>Loading...</p>
            </div>
        </div>
    </div>
</body>
</html>`;
      }
      
      // Inject runtime configuration and set base href
      const basePath = _req.baseUrl || '/studio';
      
      const runtimeConfig = {
        mode: process.env.NODE_ENV || 'production',
        apiUrl: '/api',  // API is at server root level
        apiBaseUrl: '/api',
        branding: config.branding || { title: 'Trokky Studio' },
        structure: config.structure || null,
        config: config.config || {},
        customFields: config.customFields || [],
        sessionConfig: config.sessionConfig || null,
        basePath
      };
      
      // Safe JSON serialization that handles functions and circular references
      const safeStringify = (obj: any): string => {
        try {
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'function') {
              return undefined; // Remove functions
            }
            if (typeof value === 'object' && value !== null) {
              // Simple circular reference check
              if (obj._seen && obj._seen.has(value)) {
                return '[Circular]';
              }
              if (!obj._seen) obj._seen = new Set();
              obj._seen.add(value);
            }
            return value;
          });
        } catch (error) {
          console.error('[ERROR] JSON serialization failed:', error);
          return '{}';
        }
      };
      
      const configJson = safeStringify(runtimeConfig);
      console.log('[DEBUG] Runtime config length:', configJson.length);
      
      // Override any hardcoded TROKKY_CONFIG from Vite build
      // Use a more robust replacement that handles nested objects
      html = html.replace(
        /window\.TROKKY_CONFIG\s*=\s*\{[\s\S]*?\};/g,
        `window.TROKKY_CONFIG = ${configJson};`
      );
      
      html = html.replace(
        '<head>',
        `<head>
    <base href="${basePath}/">
    <script>
      window.TROKKY_CONFIG = ${configJson};
    </script>`
      );
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('[ERROR] Failed to serve Studio HTML:', error);
      res.status(500).json({ error: 'Failed to serve Studio' });
    }
  };
}

/**
 * Serve Studio static assets
 */
function serveStudioAssets() {
  return async (req: Request, res: Response) => {
    try {
      // Assets handling only works in Node.js environment
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const url = require('url');
      const path = require('path');
      
      const currentFile = url.fileURLToPath(import.meta.url);
      const currentDir = path.dirname(currentFile);
      
      // Check if we're running from TypeScript source or compiled dist
      const isTypeScript = currentFile.includes('/src/');
      const assetPath = isTypeScript 
        ? path.join(currentDir, '..', req.path)  // From src/ to dist/
        : path.join(currentDir, req.path);       // Already in dist/
      
      // Set proper MIME types
      const ext = path.extname(req.path);
      if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css');
      } else if (ext === '.js') {
        res.setHeader('Content-Type', 'application/javascript');
      }
      
      res.sendFile(assetPath, (err: any) => {
        if (err) {
          console.error('[ERROR] Failed to serve asset:', req.path, err.message);
          res.status(404).json({ error: 'Asset not found' });
        }
      });
    } catch (e) {
      // Return 404 for asset not found
      res.status(404).json({ error: 'Asset not found' });
    }
  };
}

// Export Studio logger for custom components
export { createStudioLogger, StudioLogger } from './utils/logger.js'
export type { LogLevel, StudioLoggerConfig } from './utils/logger.js'

// Export Studio asset serving utilities
export { getStudioHTML, getStudioAsset } from './server/assets.js'

// Export main types
export type { StudioConfig, StudioMiddleware }