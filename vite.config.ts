import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
//
// PWA Strategy: We do NOT use vite-plugin-pwa here because our Service Worker
// and Web App Manifest are served DYNAMICALLY by Express — one per tenant,
// branded with that store's name/logo/color.
//
// The SW is registered via an inline <script> in index.html that calls
// navigator.serviceWorker.register('/sw.js'). Express serves that file
// at runtime with tenant-specific cache names injected.
//
// During development, Vite proxies /manifest.webmanifest and /sw.js to
// the Express server (port 9095) so the full PWA flow works in dev too.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9095',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:9095',
        changeOrigin: true,
      },
      // Proxy dynamic PWA files to Express in dev mode so the install
      // prompt and manifest work identically in dev and production.
      '/manifest.webmanifest': {
        target: 'http://localhost:9095',
        changeOrigin: true,
      },
      '/sw.js': {
        target: 'http://localhost:9095',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});


