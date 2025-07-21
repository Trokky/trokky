import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

// Single-file build for zero-config deployment
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile({
      removeViteModuleLoader: true,
      inlinePattern: ['**/*.css', '**/*.js'],
      useRecommendedBuildConfig: true
    })
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000, // Inline all assets
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    }
  },
  
  define: {
    // Ensure production build
    'process.env.NODE_ENV': '"production"'
  }
});