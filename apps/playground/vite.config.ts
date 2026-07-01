import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PDFJS_ROOT = path.dirname(
  require.resolve('pdfjs-dist/package.json', {
    paths: [path.resolve(__dirname, '../../packages/viewer'), __dirname],
  }),
);
const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

function copyPdfjsAssets(): Plugin {
  return {
    name: 'copy-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const m = url.match(/\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/(.+)$/);
        if (!m) return next();
        fs.promises
          .readFile(path.join(PDFJS_ROOT, m[1], m[2]))
          .then((buf) => {
            if (url.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
            res.end(buf);
          })
          .catch(() => next());
      });
    },
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist');
      await Promise.all(
        PDFJS_ASSET_DIRS.map((d) =>
          fs.promises.cp(path.join(PDFJS_ROOT, d), path.join(outDir, 'pdfjs', d), {
            recursive: true,
          }),
        ),
      );
    },
  };
}

export default defineConfig({
  // Set to "/anyview/" by the GitHub Pages workflow; "/" everywhere else.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react(), copyPdfjsAssets()],
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
