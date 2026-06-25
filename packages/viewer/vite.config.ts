import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// Keep the CSS asset name stable (the "./styles" export → dist/viewer.css) and
// identical across both outputs so Vite doesn't warn or emit a duplicate.
const assetFileNames = (assetInfo: { name?: string }) =>
  assetInfo.name?.endsWith('.css') ? 'viewer.css' : 'assets/[name][extname]';

// Mark the main entry as a React Client Component so the package works in the
// Next.js App Router (Server Components otherwise reject hooks/browser APIs).
// 'use client' on the entry covers everything it imports, so the adapter
// subpaths (lazy-loaded, browser-only) don't each need it.
const clientBanner = (chunk: { isEntry?: boolean; name?: string }) =>
  chunk.isEntry && chunk.name === 'index' ? "'use client';" : '';

export default defineConfig({
  // Relative base so the bundled PDF Web Worker resolves via `import.meta.url`
  // relative to the package — NOT the consumer's site root (which 404s).
  base: './',
  plugins: [
    react(),
    dts({ include: ['src'], exclude: ['**/*.test.*', 'apps/**'] }),
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
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
