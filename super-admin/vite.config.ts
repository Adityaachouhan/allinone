import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5174,
    proxy: {
      '/superadmin/api': {
        target: 'http://localhost:9095',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist-superadmin',
    emptyOutDir: true,
  },
  // ── Production base path ──────────────────────────────────────────────────
  // When served via Nginx at /superadmin, all assets must be prefixed with /superadmin/
  // This only affects production builds (npm run build), not the dev server.
  base: process.env.NODE_ENV === 'production' ? '/superadmin/' : '/',
});
