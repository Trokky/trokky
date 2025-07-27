/**
 * Integrated Studio for Direct CMS Integration
 * 
 * This provides a Sanity-like developer experience where Studio
 * is integrated directly with the CMS instance, eliminating the
 * need for HTTP discovery, CORS configuration, and network overhead.
 */

import type { Request, Response } from 'express';
import { createStudioLogger } from '../utils/logger.js';

// Local type definitions to avoid importing @trokky/core in browser
interface TrokkyCore {
  getAllSchemas(): any[];
  listDocuments(schema: string, options?: any): Promise<any[]>;
  getDocument(schema: string, id: string): Promise<any>;
  saveDocument(schema: string, data: any): Promise<any>;
  deleteDocument(schema: string, id: string): Promise<void>;
  
  // Media methods
  uploadMedia(file: any): Promise<any>;
  getMedia(id: string): Promise<any>;
  updateMedia(id: string, metadata: Record<string, any>): Promise<any>;
  getMediaContent(id: string): Promise<ArrayBuffer>;
  listMedia(options?: any): Promise<any[]>;
  deleteMedia(id: string): Promise<void>;
  
  // Auth methods
  authenticateUser(username: string, password: string): Promise<{ user: any; accessToken: string; refreshToken: string } | null>;
  verifyAuthToken(token: string): Promise<any | null>;
  refreshAuthToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null>;
  createUser(userData: any): Promise<any>;
  updateUser(id: string, userData: any): Promise<any>;
  deleteUser(id: string): Promise<void>;
  listUsers(options?: any): Promise<any[]>;
  
  // App token methods
  createAppToken(tokenData: any, createdBy: string): Promise<{ token: string; appToken: any }>;
  listAppTokens(options?: any): Promise<any[]>;
  updateAppToken(id: string, tokenData: any): Promise<any>;
  deleteAppToken(id: string): Promise<void>;
  getAppToken(id: string): Promise<any>;
}

interface FieldType<Config = any, Value = any> {
  name: string;
  category?: string | any;
  description?: string;
  icon?: string;
  validate?: (value: Value, config: Config, context?: any) => any;
  serialize?: (value: Value, config: Config) => any;
  deserialize?: (data: any, config: Config) => Value;
  defaultValue?: Value | ((config: Config) => Value);
  examples?: Array<{
    title: string;
    config: Config;
    value: Value;
  }>;
  component?: any;
  preview?: any;
}
// Note: Field registry initialization happens in browser-side code only

interface IntegratedStudioConfig {
  /** Direct CMS instance - no HTTP layer needed */
  cms: TrokkyCore;
  
  /** Mount point for Studio (default: '/admin') */
  mount?: string;
  
  /** Enable authentication (uses CMS auth) */
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
  customFields?: FieldType[];
  
  /** Additional Studio configuration */
  config?: {
    pageSize?: number;
    enableDrafts?: boolean;
    enableVersioning?: boolean;
  };
}

interface StudioMiddleware {
  /** Express router containing Studio routes */
  router: any;
  
  /** Direct API for programmatic access */
  api: StudioAPI;
}

interface StudioAPI {
  /** Get all schemas */
  getSchemas(): any[];
  
  /** Get documents for a schema */
  getDocuments(schema: string, options?: any): Promise<any[]>;
  
  /** Get single document */
  getDocument(schema: string, id: string): Promise<any>;
  
  /** Create document */
  createDocument(schema: string, data: any): Promise<any>;
  
  /** Update document */
  updateDocument(schema: string, id: string, data: any): Promise<any>;
  
  /** Delete document */
  deleteDocument(schema: string, id: string): Promise<void>;
}

/**
 * Create an integrated Studio middleware
 * 
 * @example
 * ```typescript
 * import { createStudio } from '@trokky/studio/integrated'
 * 
 * const studio = createStudio({
 *   cms: myCmsInstance,
 *   mount: '/admin',
 *   branding: { title: 'My Blog Admin' }
 * })
 * 
 * app.use('/admin', studio.router)
 * ```
 */
export async function createStudio(config: IntegratedStudioConfig): Promise<StudioMiddleware> {
  const logger = createStudioLogger('IntegratedStudio');
  
  // Note: Field registry initialization happens in browser-side Studio code
  // Custom field types are passed via runtime config to browser
  
  // Import Express synchronously for Node.js environment
  let router: any;
  
  // For the integrated studio, we know we're in Node.js, so we can use createRequire
  try {
    // Use createRequire from module to import Express in ES module context
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const express = require('express');
    router = express.Router();
  } catch (e) {
    console.error('[ERROR] Failed to import Express:', e);
    throw new Error('Express is required for integrated Studio but could not be imported');
  }
  
  logger.info('Creating integrated Studio', {
    mount: config.mount || '/admin',
    auth: config.auth || false,
    schemas: config.cms.getAllSchemas().length,
    customFields: config.customFields?.length || 0
  });

  // Create direct API interface
  const api: StudioAPI = {
    getSchemas: () => config.cms.getAllSchemas(),
    
    getDocuments: async (schema: string, options?: any) => {
      return config.cms.listDocuments(schema, options);
    },
    
    getDocument: async (schema: string, id: string) => {
      return config.cms.getDocument(schema, id);
    },
    
    createDocument: async (schema: string, data: any) => {
      return config.cms.saveDocument(schema, data);
    },
    
    updateDocument: async (schema: string, id: string, data: any) => {
      return config.cms.saveDocument(schema, { ...data, id });
    },
    
    deleteDocument: async (schema: string, id: string) => {
      return config.cms.deleteDocument(schema, id);
    }
  };

  // Serve Studio static assets
  router.get('/', serveStudioHTML(config));
  router.get('/assets/*', serveStudioAssets());
  
  
  // API routes with direct CMS integration
  setupAPIRoutes(router, api, config);
  
  // Catch-all route for SPA routing - must be last
  router.get('*', serveStudioHTML(config));
  
  return { router, api };
}

/**
 * Serve the Studio HTML with injected configuration
 */
function serveStudioHTML(config: IntegratedStudioConfig) {
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
        const isTypeScript = currentFile.includes('/src/integrated/');
        const htmlPath = isTypeScript 
          ? path.join(currentDir, '../../dist/index.html')  // From src/integrated/ to dist/
          : path.join(currentDir, '../index.html');         // From dist/integrated/ to dist/
        html = fs.readFileSync(htmlPath, 'utf-8');
      } catch (e) {
        console.error('[ERROR] Failed to read Studio HTML:', e.message);
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
      const basePath = _req.baseUrl || '/admin';
      const runtimeConfig = {
        mode: 'integrated',
        schemas: config.cms.getAllSchemas(),
        branding: config.branding || { title: 'Trokky Studio' },
        structure: config.structure || null,
        config: config.config || {},
        customFields: config.customFields || [],
        basePath
      };
      
      html = html.replace(
        '<head>',
        `<head>
    <base href="${basePath}/">
    <script>
      window.TROKKY_INTEGRATED_CONFIG = ${JSON.stringify(runtimeConfig)};
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
      const fs = require('fs');
      
      const currentFile = url.fileURLToPath(import.meta.url);
      const currentDir = path.dirname(currentFile);
      
      // Check if we're running from TypeScript source or compiled dist
      const isTypeScript = currentFile.includes('/src/integrated/');
      const assetPath = isTypeScript 
        ? path.join(currentDir, '../..', req.path)  // From src/integrated/ to dist/
        : path.join(currentDir, '..', req.path);    // From dist/integrated/ to dist/
      
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

/**
 * Setup API routes with direct CMS integration
 */
function setupAPIRoutes(router: any, api: StudioAPI, _config: IntegratedStudioConfig) {
  // Collections metadata
  router.get('/api/collections', (_req: Request, res: Response) => {
    try {
      const schemas = api.getSchemas();
      const collections = schemas.map(schema => ({
        name: schema.name,
        title: schema.title || schema.name,
        type: schema.type || 'document'
      }));
      res.json({ collections });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get collections' });
    }
  });

  // Documents for a collection
  router.get('/api/collections/:collection', async (req: Request, res: Response) => {
    try {
      const { collection } = req.params;
      const documents = await api.getDocuments(collection, req.query);
      res.json({ documents });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get documents' });
    }
  });

  // Single document
  router.get('/api/collections/:collection/:id', async (req: Request, res: Response) => {
    try {
      const { collection, id } = req.params;
      const document = await api.getDocument(collection, id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json({ document });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get document' });
    }
  });

  // Create document
  router.post('/api/collections/:collection', async (req: Request, res: Response) => {
    try {
      const { collection } = req.params;
      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: 'Document data is required' });
      }
      
      const document = await api.createDocument(collection, data);
      res.status(201).json({ document });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create document' });
    }
  });

  // Update document
  router.put('/api/collections/:collection/:id', async (req: Request, res: Response) => {
    try {
      const { collection, id } = req.params;
      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: 'Document data is required' });
      }
      
      const document = await api.updateDocument(collection, id, data);
      res.json({ document });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update document' });
    }
  });

  // Delete document
  router.delete('/api/collections/:collection/:id', async (req: Request, res: Response) => {
    try {
      const { collection, id } = req.params;
      await api.deleteDocument(collection, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // Stats endpoints for Studio analytics
  router.get('/stats/:collection', async (req: Request, res: Response) => {
    try {
      const { collection } = req.params;
      const documents = await api.getDocuments(collection);
      const docArray = Array.isArray(documents) ? documents : [];
      const stats = {
        total: docArray.length || 0,
        published: docArray.filter((doc: any) => doc.published).length || 0,
        drafts: docArray.filter((doc: any) => !doc.published).length || 0,
        lastUpdated: docArray.length > 0 
          ? Math.max(...docArray.map((doc: any) => new Date(doc._updatedAt || doc._createdAt).getTime()))
          : null
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get collection stats' });
    }
  });

  // Authentication endpoints
  router.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe = false } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Username and password are required' }
        });
      }
      
      // Use core engine's authentication method
      const authResult = await _config.cms.authenticateUser(username, password, { rememberMe });
      if (!authResult) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
        });
      }
      
      const { user: authenticatedUser, token, refreshToken } = authResult;
      
      // Get token expiration time
      const session = await _config.cms.verifyAuthToken(token);
      
      res.json({
        success: true,
        data: {
          token,
          refreshToken: refreshToken || token, // Fallback to token if no refresh token
          user: authenticatedUser,
          expiresAt: session?.expiresAt
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' }
      });
    }
  });

  router.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      // For now, logout is client-side token removal
      // In a full implementation, we'd invalidate the token server-side
      res.json({
        success: true,
        data: { message: 'Logged out successfully' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Logout failed' }
      });
    }
  });

  router.post('/api/auth/validate', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      
      console.log('[DEBUG] Token validation request:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenStart: token ? token.substring(0, 20) + '...' : 'none'
      });
      
      if (!token) {
        console.log('[DEBUG] Token validation failed: No token provided');
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Token is required' }
        });
      }
      
      // Validate token using core engine's JWT verification
      const session = await _config.cms.verifyAuthToken(token);
      const isValid = session !== null;
      
      console.log('[DEBUG] Token validation result:', {
        isValid,
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : []
      });
      
      res.json({
        success: true,
        data: {
          valid: isValid,
          message: isValid ? 'Token is valid' : 'Token is invalid',
          session: isValid ? session : undefined
        }
      });
    } catch (error) {
      console.error('[ERROR] Token validation error:', error.message);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Token validation failed' }
      });
    }
  });

  // Enhanced Auth Routes
  
  // Refresh token endpoint
  router.post('/api/auth/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ 
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Refresh token is required' }
        });
      }
      
      const result = await _config.cms.refreshAuthToken(refreshToken);
      
      if (!result) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' }
        });
      }
      
      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Token refresh failed' }
      });
    }
  });

  // User Management Routes (Admin only)
  
  // List users
  router.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await _config.cms.listUsers(req.query);
      res.json({
        success: true,
        data: { users }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' }
      });
    }
  });

  // Create user
  router.post('/api/users', async (req: Request, res: Response) => {
    try {
      const userData = req.body;
      
      if (!userData.username || !userData.email || !userData.password) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Username, email, and password are required' }
        });
      }
      
      const user = await _config.cms.createUser(userData);
      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' }
      });
    }
  });

  // Update user
  router.put('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userData = req.body;
      
      const user = await _config.cms.updateUser(id, userData);
      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' }
      });
    }
  });

  // Delete user
  router.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await _config.cms.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' }
      });
    }
  });

  // App Token Management Routes
  
  // List app tokens
  router.get('/api/tokens', async (req: Request, res: Response) => {
    try {
      const tokens = await _config.cms.listAppTokens(req.query);
      res.json({
        success: true,
        data: { tokens }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list app tokens' }
      });
    }
  });

  // Create app token
  router.post('/api/tokens', async (req: Request, res: Response) => {
    try {
      const tokenData = req.body;
      const createdBy = req.body.createdBy || 'system'; // Should come from auth context
      
      if (!tokenData.name || !tokenData.permissions) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Token name and permissions are required' }
        });
      }
      
      const result = await _config.cms.createAppToken(tokenData, createdBy);
      res.json({
        success: true,
        data: {
          token: result.token, // Plain text token (only returned once)
          appToken: result.appToken
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create app token' }
      });
    }
  });

  // Get app token (without revealing the actual token)
  router.get('/api/tokens/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const token = await _config.cms.getAppToken(id);
      
      if (!token) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'App token not found' }
        });
      }
      
      res.json({
        success: true,
        data: { token }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get app token' }
      });
    }
  });

  // Update app token
  router.put('/api/tokens/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tokenData = req.body;
      
      const token = await _config.cms.updateAppToken(id, tokenData);
      res.json({
        success: true,
        data: { token }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update app token' }
      });
    }
  });

  // Delete app token
  router.delete('/api/tokens/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await _config.cms.deleteAppToken(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete app token' }
      });
    }
  });

  // Individual schema endpoint
  router.get('/api/schemas/:schemaName', (req: Request, res: Response) => {
    try {
      const { schemaName } = req.params;
      const schemas = api.getSchemas();
      const schema = schemas.find(s => s.name === schemaName);
      
      if (!schema) {
        return res.status(404).json({ error: `Schema '${schemaName}' not found` });
      }
      
      // Convert fields object to array format expected by DocumentEditor
      const convertedSchema = {
        ...schema,
        fields: schema.fields && typeof schema.fields === 'object' && !Array.isArray(schema.fields)
          ? Object.entries(schema.fields).map(([name, config]: [string, any]) => ({
              name,
              title: config.title || name, // Ensure title is properly preserved
              type: config.type,
              required: config.required || false,
              description: config.description,
              maxLength: config.maxLength,
              defaultValue: config.defaultValue,
              to: config.to, // For reference fields
              of: config.of, // For array fields
              options: config.options
            }))
          : schema.fields || []
      };
      
      res.json(convertedSchema);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get schema' });
    }
  });

  // Media endpoints - moved to /api/media to avoid conflict with Studio routing
  router.get('/api/media', async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Media files list request starting...');
      const mediaFiles = await _config.cms.listMedia(req.query);
      
      console.log('[DEBUG] Media files list request result:', {
        query: req.query,
        filesCount: mediaFiles?.length || 0,
        files: mediaFiles?.map((f: any) => ({ id: f.id, name: f.filename, size: f.size })) || []
      });
      
      res.json({
        success: true,
        data: mediaFiles
      });
    } catch (error) {
      console.error('[ERROR] Failed to list media files:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get media files' }
      });
    }
  });

  router.post('/api/media', async (req: Request, res: Response) => {
    try {
      // Parse multipart/form-data using native Web APIs for edge compatibility
      const contentType = req.headers['content-type'] || req.get('content-type');
      
      console.log('[DEBUG] Media upload request headers:', {
        contentType,
        userAgent: req.get('user-agent'),
        contentLength: req.get('content-length')
      });
      
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_INPUT', 
            message: `Content-Type must be multipart/form-data, received: ${contentType || 'none'}` 
          }
        });
      }

      // Extract boundary from content-type header
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Missing boundary in multipart data' }
        });
      }

      // Read the raw body as buffer for proper binary handling
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      
      await new Promise((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });

      const body = Buffer.concat(chunks);
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      
      // Find file part by splitting on boundary
      const parts: Buffer[] = [];
      let start = 0;
      let pos = body.indexOf(boundaryBuffer, start);
      
      while (pos !== -1) {
        if (start !== pos) {
          parts.push(body.subarray(start, pos));
        }
        start = pos + boundaryBuffer.length;
        pos = body.indexOf(boundaryBuffer, start);
      }
      if (start < body.length) {
        parts.push(body.subarray(start));
      }

      let fileFound = false;
      let fileName = 'unnamed';
      let fileType = 'application/octet-stream';
      let fileBuffer: Buffer;
      
      console.log('[DEBUG] Multipart parsing:', {
        boundary,
        partsCount: parts.length,
        bodyLength: body.length
      });

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partStr = part.toString('utf8', 0, Math.min(500, part.length)); // Only convert header portion to string
        
        console.log(`[DEBUG] Part ${i} header:`, partStr.substring(0, 200).replace(/[\r\n]/g, '\\n'));
        
        if (partStr.includes('Content-Disposition: form-data') && partStr.includes('filename=')) {
          // Extract filename from UTF-8 string
          const fileNameMatch = partStr.match(/filename="([^"]+)"/) || partStr.match(/filename=([^;\r\n]+)/);
          if (fileNameMatch) {
            const rawFileName = fileNameMatch[1].trim();
            // Sanitize filename to only include allowed characters
            fileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            console.log('[DEBUG] Extracted filename - raw:', rawFileName, 'sanitized:', fileName);
            
            // Final validation - if still invalid, use fallback
            if (!/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.length === 0) {
              fileName = 'upload_' + Date.now() + '.bin';
              console.log('[DEBUG] Filename still invalid, using fallback:', fileName);
            }
          }

          // Extract content type
          const contentTypeMatch = partStr.match(/Content-Type:\s*([^\r\n]+)/);
          if (contentTypeMatch) {
            fileType = contentTypeMatch[1].trim();
          }

          // Validate file type
          const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'video/mp4', 'video/webm', 'video/mov', 'video/quicktime',
            'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/csv'
          ];
          
          if (!allowedTypes.includes(fileType)) {
            return res.status(400).json({
              success: false,
              error: { code: 'INVALID_FILE_TYPE', message: `File type ${fileType} not allowed` }
            });
          }

          // Find the start of file data (after double CRLF)
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
          if (headerEnd !== -1) {
            fileBuffer = part.subarray(headerEnd + 4);
            
            // Remove trailing boundary markers if present
            const trailingBoundary = Buffer.from(`\r\n--${boundary}`);
            const boundaryPos = fileBuffer.lastIndexOf(trailingBoundary);
            if (boundaryPos !== -1) {
              fileBuffer = fileBuffer.subarray(0, boundaryPos);
            }
            
            // Check file size (100MB limit)
            if (fileBuffer.length > 100 * 1024 * 1024) {
              return res.status(400).json({
                success: false,
                error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds 100MB limit' }
              });
            }
            
            console.log('[DEBUG] File data extracted:', {
              fileName,
              fileType,
              fileSize: fileBuffer.length
            });
            
            fileFound = true;
            break;
          }
        }
      }

      if (!fileFound) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'No file provided' }
        });
      }

      // Ensure we have a valid filename
      if (!fileName || fileName === 'unnamed') {
        fileName = 'upload_' + Date.now() + '.bin';
        console.log('[DEBUG] No valid filename found, using fallback:', fileName);
      }

      // Create a File-like object for the CMS using Web API standards
      const fileObject = {
        name: fileName,
        type: fileType,
        size: fileBuffer!.length,
        arrayBuffer: async () => fileBuffer!,
        stream: () => new ReadableStream({
          start(controller) {
            controller.enqueue(fileBuffer!);
            controller.close();
          }
        }),
        text: async () => fileBuffer!.toString(),
        slice: () => fileObject
      } as File;

      // Upload through CMS
      const mediaFile = await _config.cms.uploadMedia(fileObject);
      
      console.log('[DEBUG] Media file uploaded successfully:', {
        id: mediaFile.id,
        filename: mediaFile.filename,
        size: mediaFile.size,
        type: mediaFile.type
      });
      
      res.json({
        success: true,
        data: mediaFile
      });
    } catch (error) {
      console.error('[ERROR] Media upload failed:', error);
      res.status(500).json({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to upload media file'
        }
      });
    }
  });

  router.get('/api/media/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const mediaFile = await _config.cms.getMedia(id);
      
      if (!mediaFile) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Media file not found' }
        });
      }

      res.json({
        success: true,
        data: { file: mediaFile }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get media file' }
      });
    }
  });

  router.put('/api/media/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { metadata } = req.body;
      
      if (!metadata || typeof metadata !== 'object') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Metadata is required' }
        });
      }
      
      // Get the existing media file first
      const existingMedia = await _config.cms.getMedia(id);
      if (!existingMedia) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Media file not found' }
        });
      }
      
      // Update the metadata using the core engine's updateMedia method
      const updatedMedia = await _config.cms.updateMedia(id, metadata);
      
      console.log('[DEBUG] Media metadata updated successfully via core engine:', { 
        id, 
        metadata,
        updatedFile: updatedMedia 
      });
      
      res.json({
        success: true,
        data: { file: updatedMedia }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update media metadata' }
      });
    }
  });

  router.delete('/api/media/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await _config.cms.deleteMedia(id);
      
      res.json({
        success: true,
        data: { message: 'Media file deleted successfully' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete media file' }
      });
    }
  });

  // Media file serving endpoint
  router.get('/api/media/:id/file', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log('[DEBUG] Serving media file:', id);
      
      // Get media metadata first
      const mediaFile = await _config.cms.getMedia(id);
      if (!mediaFile) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Media file ${id} not found` }
        });
      }

      // Get file content
      const content = await _config.cms.getMediaContent(id);
      if (!content) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Media file content ${id} not found` }
        });
      }

      // Convert ArrayBuffer to Buffer for HTTP response
      const buffer = Buffer.from(content);

      // Set headers for file serving
      res.set({
        'Content-Type': mediaFile.contentType,
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `inline; filename="${mediaFile.filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'ETag': `"${id}"`
      });

      console.log('[DEBUG] Serving media file successfully:', {
        id,
        filename: mediaFile.filename,
        contentType: mediaFile.contentType,
        size: buffer.length
      });

      res.send(buffer);
    } catch (error) {
      console.error('[ERROR] Media file serving failed:', error);
      res.status(500).json({
        success: false,
        error: { 
          code: 'MEDIA_SERVE_FAILED', 
          message: error instanceof Error ? error.message : 'Failed to serve media file' 
        }
      });
    }
  });

  // Slug uniqueness validation endpoint
  router.get('/api/slugs/check-unique', async (req: Request, res: Response) => {
    try {
      const { slug, collection, excludeId } = req.query;
      
      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Slug parameter is required' }
        });
      }
      
      if (!collection || typeof collection !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Collection parameter is required' }
        });
      }

      console.log('[DEBUG] Checking slug uniqueness:', { slug, collection, excludeId });

      // Check if slug exists in the collection
      const documents = await _config.cms.listDocuments(collection, {
        filter: { slug: slug }
      });

      console.log('[DEBUG] Found documents with slug:', documents.length);

      // If excludeId is provided, filter out that document (for updates)
      const conflictingDocs = excludeId 
        ? documents.filter(doc => doc._id !== excludeId)
        : documents;

      const isUnique = conflictingDocs.length === 0;

      const responseData = { 
        unique: isUnique,
        slug: slug,
        collection: collection,
        ...(isUnique ? {} : { reason: 'Slug already exists in collection' })
      };

      console.log('[DEBUG] Slug uniqueness result:', responseData);

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('[ERROR] Slug uniqueness check failed:', error);
      res.status(500).json({
        success: false,
        error: { 
          code: 'SLUG_CHECK_FAILED', 
          message: error instanceof Error ? error.message : 'Failed to check slug uniqueness' 
        }
      });
    }
  });
}

// Re-export types that were declared above
export type {
  IntegratedStudioConfig,
  StudioMiddleware, 
  StudioAPI
};