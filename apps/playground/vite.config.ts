import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      'anyview': path.resolve(__dirname, '../../packages/viewer/src/index.ts'),
    },
  },
});
