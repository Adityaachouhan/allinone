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
});
