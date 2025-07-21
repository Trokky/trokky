import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Auto-proxy API calls to common backend ports during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Fallback to other common ports if 3000 fails
          proxy.on('error', () => {
            console.log('Trying fallback backend ports...');
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