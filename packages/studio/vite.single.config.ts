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
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000, // Inline all assets
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        // Rolldown's replacement for `inlineDynamicImports`: everything has to
        // land in one chunk for the single-file bundle to be complete.
        codeSplitting: false
      }
    }
  },
  
  define: {
    // Ensure production build
    'process.env.NODE_ENV': '"production"'
  }
});