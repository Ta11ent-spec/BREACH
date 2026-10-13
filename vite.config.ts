import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Hash routes (#/overview) work on static hosting without special rewrites.
  base: './',
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:5087', changeOrigin: true } } },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: false },
});
