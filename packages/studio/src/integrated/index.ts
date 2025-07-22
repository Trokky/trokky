/**
 * Integrated Studio for Direct CMS Integration
 * 
 * This provides a Sanity-like developer experience where Studio
 * is integrated directly with the CMS instance, eliminating the
 * need for HTTP discovery, CORS configuration, and network overhead.
 */

import type { Request, Response } from 'express';
import { TrokkyCore } from '@trokky/core';
import { createStudioLogger } from '../utils/logger.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

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
export function createStudio(config: IntegratedStudioConfig): StudioMiddleware {
  const logger = createStudioLogger('IntegratedStudio');
  
  // Dynamically import express Router to avoid build-time dependency
  const require = createRequire(import.meta.url);
  const express = require('express');
  const router = express.Router();
  
  logger.info('Creating integrated Studio', {
    mount: config.mount || '/admin',
    auth: config.auth || false,
    schemas: config.cms.getAllSchemas().length
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
  router.get('/demo-config.js', serveStudioAssets());
  
  console.log('[DEBUG] Registered routes for integrated Studio');
  
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
      // Get Studio HTML template (relative to compiled JS in dist/integrated/)
      // Recreate __dirname for ES modules
      const currentFile = fileURLToPath(import.meta.url);
      const currentDir = path.dirname(currentFile);
      const htmlPath = path.join(currentDir, '../index.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');
      
      // Inject runtime configuration and set base href
      const basePath = _req.baseUrl || '/admin';
      const runtimeConfig = {
        mode: 'integrated',
        schemas: config.cms.getAllSchemas(),
        branding: config.branding || { title: 'Trokky Studio' },
        structure: config.structure || null,
        config: config.config || {},
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
  return (req: Request, res: Response) => {
    // Assets are relative to compiled JS in dist/integrated/
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    const assetPath = path.join(currentDir, '..', req.path);
    
    console.log('[DEBUG] Asset request:', req.path);
    console.log('[DEBUG] Full asset path:', assetPath);
    console.log('[DEBUG] Asset exists:', fs.existsSync(assetPath));
    
    // Set proper MIME types
    const ext = path.extname(req.path);
    if (ext === '.css') {
      res.setHeader('Content-Type', 'text/css');
    } else if (ext === '.js') {
      res.setHeader('Content-Type', 'application/javascript');
    }
    
    res.sendFile(assetPath, (err) => {
      if (err) {
        console.error('[ERROR] Failed to serve asset:', req.path, err.message);
        res.status(404).json({ error: 'Asset not found' });
      }
    });
  };
}

/**
 * Setup API routes with direct CMS integration
 */
function setupAPIRoutes(router: any, api: StudioAPI, _config: IntegratedStudioConfig) {
  // Collections metadata
  router.get('/api/collections', async (_req: Request, res: Response) => {
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
}

// Re-export types that were declared above
export type {
  IntegratedStudioConfig,
  StudioMiddleware, 
  StudioAPI
};