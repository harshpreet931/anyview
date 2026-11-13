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
      await fs.promises.writeFile(path.join(outDir, 'styles.d.ts'), 'export {};\n');
    },
  };
}

const PDF_WORKER_ENTRY = 'adapters/pdf/pdf.worker';
const PDF_ASSET_FILES: Record<string, RegExp> = {
  cmaps: /\.bcmap$/,
  standard_fonts: /\.(pfb|ttf)$/,
  wasm: /\.wasm$/,
};

function relativeFrom(chunkFile: string, target: string): string {
  const rel = path.posix.relative(path.posix.dirname(chunkFile), target);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function pdfWorkerForBundlers(): Plugin {
  const assetPaths = Object.entries(PDF_ASSET_FILES).flatMap(([dir, re]) =>
    fs
      .readdirSync(path.join(PDFJS_ROOT, dir))
      .filter((f) => re.test(f))
      .map((f) => `${dir}/${f}`),
  );
  return {
    name: 'pdf-worker-for-bundlers',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/adapters/pdf/PdfAdapter.ts')) return null;
      const from = "new URL('./pdf.worker.ts', import.meta.url)";
      if (!code.includes(from)) this.error('PdfAdapter worker URL not found');
      return code.replace(from, 'new URL(__ANYVIEW_PDF_WORKER__, import.meta.url)');
    },
    generateBundle(options, bundle) {
      const isEsm = options.format === 'es';
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        if (chunk.code.includes('__ANYVIEW_PDF_WORKER__')) {
          const url = JSON.stringify(relativeFrom(chunk.fileName, `${PDF_WORKER_ENTRY}.js`));
          chunk.code = isEsm
            ? chunk.code.replaceAll('__ANYVIEW_PDF_WORKER__', url)
            : chunk.code.replace(
                /new URL\(__ANYVIEW_PDF_WORKER__,[^)]*\)/g,
                `new URL(${url},typeof document>"u"?require("url").pathToFileURL(__filename).href:document.currentScript&&document.currentScript.src||document.baseURI)`,
              );
        }
        if (isEsm && /new URL\("\.\.\/pdfjs\/",\s*""\s*\+\s*import\.meta\.url\)/.test(chunk.code)) {
          const base = JSON.stringify(`${relativeFrom(chunk.fileName, 'pdfjs')}/`);
          chunk.code = chunk.code.replace(
            /new URL\("\.\.\/pdfjs\/",\s*""\s*\+\s*import\.meta\.url\)/g,
            `new URL(import.meta.url.replace(/[^/]*$/, "") + ${base})`,
          );
        }
        if (isEsm && chunk.code.includes('__ANYVIEW_PDF_ASSETS__')) {
          const entries = assetPaths.map(
            (a) =>
              `${JSON.stringify(a)}:new URL(${JSON.stringify(relativeFrom(chunk.fileName, `pdfjs/${a}`))},import.meta.url).href`,
          );
          chunk.code = chunk.code
            .replaceAll('typeof __ANYVIEW_PDF_ASSETS__', '"object"')
            .replaceAll('__ANYVIEW_PDF_ASSETS__', `({${entries.join(',')}})`);
        }
      }
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
    pdfWorkerForBundlers(),
  ],
  worker: {
    format: 'es',
  },
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        'adapters/pdf/index': 'src/adapters/pdf/index.ts',
        [PDF_WORKER_ENTRY]: 'src/adapters/pdf/pdf.worker.ts',
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
        'pdfjs-dist', /^pdfjs-dist\//, 'mammoth', 'xlsx', 'papaparse',
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
