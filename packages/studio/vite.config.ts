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
          const backendUrl = process.env.TROKKY_BACKEND_URL || 'http://localhost:3001';
          
          return html.replace(
            '<head>',
            `<head>
    <script>
      window.TROKKY_CONFIG = {
        backendUrl: '${backendUrl}',
        timeout: 30000,
        branding: {
          title: 'Trokky Studio',
          theme: 'system'
        }
      };
    </script>`
          );
        }
      }
    }
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Auto-proxy API calls to demo backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Log proxy requests for debugging
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`Proxying ${req.method} ${req.url} to backend on port 3001`);
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
      output: {
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