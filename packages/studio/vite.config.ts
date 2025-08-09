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
        apiUrl: '/api',
        apiBaseUrl: '/api',
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
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  define: {
    global: 'globalThis',
  },
  
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Auto-proxy API calls to demo backend during development
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Log proxy requests for debugging
          const targetUrl = process.env.VITE_API_URL || 'http://localhost:3000';
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`Proxying ${req.method} ${req.url} to backend at ${targetUrl}`);
          });
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err.message);
          });
        }
      }
    }
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
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
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          ui: ['@headlessui/react', '@heroicons/react']
        }
      }
    }
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
});