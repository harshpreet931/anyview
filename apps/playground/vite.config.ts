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
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react(), copyPdfjsAssets()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        examples: path.resolve(__dirname, 'examples/index.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      'anyview/core': path.resolve(__dirname, '../../packages/viewer/src/core/index.ts'),
      'anyview/pdf': path.resolve(__dirname, '../../packages/viewer/src/adapters/pdf/index.ts'),
      'anyview/docx': path.resolve(__dirname, '../../packages/viewer/src/adapters/docx/index.ts'),
      'anyview/xlsx': path.resolve(__dirname, '../../packages/viewer/src/adapters/xlsx/index.ts'),
      'anyview/pptx': path.resolve(__dirname, '../../packages/viewer/src/adapters/pptx/index.ts'),
      'anyview/image': path.resolve(__dirname, '../../packages/viewer/src/adapters/image/index.ts'),
      'anyview/markdown': path.resolve(__dirname, '../../packages/viewer/src/adapters/markdown/index.ts'),
      'anyview/code': path.resolve(__dirname, '../../packages/viewer/src/adapters/code/index.ts'),
      'anyview/csv': path.resolve(__dirname, '../../packages/viewer/src/adapters/csv/index.ts'),
      'anyview/html': path.resolve(__dirname, '../../packages/viewer/src/adapters/html/index.ts'),
      'anyview/ipynb': path.resolve(__dirname, '../../packages/viewer/src/adapters/ipynb/index.ts'),
      'anyview/text': path.resolve(__dirname, '../../packages/viewer/src/adapters/text/index.ts'),
      'anyview': path.resolve(__dirname, '../../packages/viewer/src/index.ts'),
    },
  },
});
