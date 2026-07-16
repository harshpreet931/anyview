import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

const assetFileNames = (assetInfo: { name?: string }) =>
  assetInfo.name?.endsWith('.css') ? 'viewer.css' : 'assets/[name][extname]';

const clientBanner = (chunk: { isEntry?: boolean; name?: string }) =>
  chunk.isEntry && chunk.name === 'index' ? "'use client';" : '';

const require = createRequire(import.meta.url);
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));
const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

// pdf.js CMaps/standard-fonts/wasm/iccs must ship in the package (dist/pdfjs/) or CJK/non-embedded glyphs render blank.
function addDeclarationExtensions(
  content: string,
  fromDir: string,
  emitted: Set<string>,
): string {
  const rewrite = (spec: string): string => {
    const isRelative =
      spec === '.' ||
      spec === '..' ||
      spec.startsWith('./') ||
      spec.startsWith('../');
    if (!isRelative) return spec;
    if (/\.(m?js|c?js|json|css|node)$/.test(spec)) return spec;
    const abs = path.resolve(fromDir, spec);
    if (emitted.has(path.resolve(`${abs}.d.ts`))) return `${spec}.js`;
    if (emitted.has(path.resolve(path.join(abs, 'index.d.ts')))) return `${spec}/index.js`;
    return spec;
  };
  return content
    .replace(/(\bfrom\s*['"])(\.[^'"]*)(['"])/g, (_m, a, s, b) => a + rewrite(s) + b)
    .replace(/(\bimport\s*\(\s*['"])(\.[^'"]*)(['"]\s*\))/g, (_m, a, s, b) => a + rewrite(s) + b);
}

function copyPdfjsAssets(): Plugin {
  return {
    name: 'copy-pdfjs-assets',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, 'dist');
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
  base: './',
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['**/*.test.*', 'apps/**'],
      afterBuild: async (emittedFiles: Map<string, string>) => {
        const emitted = new Set(
          [...emittedFiles.keys()].map((p) => path.resolve(p)),
        );
        await Promise.all(
          [...emittedFiles.entries()].map(async ([filePath, content]) => {
            if (!filePath.endsWith('.d.ts')) return;
            const abs = path.resolve(filePath);
            const next = addDeclarationExtensions(
              content,
              path.dirname(abs),
              emitted,
            );
            if (next !== content) await fs.promises.writeFile(abs, next);
          }),
        );
      },
    }),
    copyPdfjsAssets(),
  ],
  worker: {
    format: 'es',
  },
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        'adapters/pdf/index': 'src/adapters/pdf/index.ts',
        'adapters/docx/index': 'src/adapters/docx/index.ts',
        'adapters/xlsx/index': 'src/adapters/xlsx/index.ts',
        'adapters/pptx/index': 'src/adapters/pptx/index.ts',
        'adapters/image/index': 'src/adapters/image/index.ts',
        'adapters/markdown/index': 'src/adapters/markdown/index.ts',
        'adapters/code/index': 'src/adapters/code/index.ts',
        'adapters/csv/index': 'src/adapters/csv/index.ts',
        'adapters/html/index': 'src/adapters/html/index.ts',
        'adapters/ipynb/index': 'src/adapters/ipynb/index.ts',
        'adapters/text/index': 'src/adapters/text/index.ts',
        'core/index': 'src/core/index.ts',
      },
    },
    rollupOptions: {
      external: [
        'react', 'react-dom', 'react/jsx-runtime',
        /^react-dom\//,
        'comlink', '@tanstack/react-virtual', 'zustand',
        'dompurify',
        'pdfjs-dist', 'mammoth', 'xlsx', 'papaparse',
        'react-markdown', 'remark-gfm', 'shiki', 'jszip',
        /^@shikijs\//,
        /^shiki\//,
      ],
      output: [
        {
          format: 'es',
          exports: 'named',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames,
          banner: clientBanner,
        },
        {
          format: 'cjs',
          exports: 'named',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          assetFileNames,
          banner: clientBanner,
        },
      ],
    },
    target: 'es2022',
    minify: 'oxc',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
