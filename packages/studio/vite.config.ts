import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Inject runtime config from environment variables
    {
      name: 'inject-config',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          const backendUrl = process.env.TROKKY_BACKEND_URL || 'http://localhost:3000';
          
          return html.replace(
            '<head>',
            `<head>
    <script>
      window.TROKKY_CONFIG = {
        mode: 'development',
        basePath: '',
        branding: {
          title: 'Trokky Studio (Dev)',
          theme: 'system'
        },
        structure: null,
        config: {},
        customFields: []
      };
    </script>`
          );
        }
      }
    },
    // Completely exclude integrated directory from browser builds
    {
      name: 'exclude-integrated',
      resolveId(id, importer) {
        // Exclude any import from the integrated directory
        if (id.includes('/integrated/') || id.includes('\\integrated\\') || 
            id.includes('/integrated') || id.includes('\\integrated') ||
            id.endsWith('integrated/index.ts') || id.endsWith('integrated\\index.ts') ||
            id.endsWith('integrated/index.js') || id.endsWith('integrated\\index.js')) {
          return { id: 'virtual:integrated-stub', external: false };
        }
        return null;
      },
      load(id) {
        if (id === 'virtual:integrated-stub') {
          return 'export const createStudio = () => ({ router: null, api: null }); export default createStudio;';
        }
        return null;
      }
    }
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  
  define: {
    global: 'globalThis',
  },
  
  server: {
    port: 5173,
    host: true,
    // No proxy needed - we use absolute URLs with complete backend URL
    // The API client now handles full URLs like http://localhost:3000/cms-api/auth/login
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      external: [
        'crypto', 
        'bcrypt', 
        'jsonwebtoken', 
        'module',
        'express',
        'fs',
        'path',
        'url',
        // Node.js built-ins that shouldn't be bundled for browser
        'fs/promises',
        'stream',
        'util',
        'os',
        // Integrated studio is server-side only (exclude all variations)
        './src/integrated/index.js',
        './src/integrated/index.ts',
        '/src/integrated/index.js',
        '/src/integrated/index.ts'
      ],
      output: {
        globals: {
          crypto: 'crypto',
          bcrypt: 'bcrypt',
          jsonwebtoken: 'jsonwebtoken',
          module: 'module',
          express: 'express',
          fs: 'fs',
          path: 'path',
          url: 'url',
          '@trokky/core': 'TrokkyCore'
        },
        // Vite 8 / Rolldown dropped the object form of `manualChunks`; the same
        // four vendor chunks are now expressed as codeSplitting groups. `test`
        // matches the resolved module id, so the patterns are anchored on the
        // package directory to avoid catching unrelated paths.
        codeSplitting: {
          groups: [
            {
              name: 'router',
              test: /[\\/]node_modules[\\/]react-router([\\/]|$)/
            },
            {
              name: 'query',
              test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query([\\/]|$)/
            },
            {
              name: 'ui',
              test: /[\\/]node_modules[\\/]@(headlessui|heroicons)[\\/]react([\\/]|$)/
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]react(-dom)?([\\/]|$)/
            }
          ]
        }
      }
    }
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router', 'react-router/dom']
  }
});