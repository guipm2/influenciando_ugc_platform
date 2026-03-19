import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Compatibilidade com navegadores mais antigos
    target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13'],
    modulePreload: {
      polyfill: true
    },
    cssTarget: ['chrome87', 'safari13', 'firefox78'],
    // Otimizações
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log em produção
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) expects manualChunks as a function.
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }

          if (id.includes('node_modules/@supabase/supabase-js')) {
            return 'supabase';
          }

          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/framer-motion')) {
            return 'ui';
          }

          return undefined;
        }
      }
    }
  },
  server: {
    // Otimizar dev server
    fs: {
      strict: false
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist']
  }
});
