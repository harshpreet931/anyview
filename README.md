<div align="center">

<img src="./assets/logo.svg" width="88" height="88" alt="Anyview" />

# Anyview

### One component. Every format. Zero iframes.

The universal document viewer for React — **PDF, DOCX, XLSX, PPTX, CSV, Markdown, code, HTML & images**, rendered natively in the browser. No iframes, no server round-trips, no uploads — your files never leave the page.

[![npm version](https://img.shields.io/npm/v/anyview?color=B8740F&labelColor=1a1813)](https://www.npmjs.com/package/anyview)
[![license](https://img.shields.io/github/license/harshpreet931/anyview?color=B8740F&labelColor=1a1813)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/anyview?color=B8740F&labelColor=1a1813)](https://bundlephobia.com/package/anyview)
[![CI](https://img.shields.io/github/actions/workflow/status/harshpreet931/anyview/ci.yml?branch=main&labelColor=1a1813)](https://github.com/harshpreet931/anyview/actions)
[![stars](https://img.shields.io/github/stars/harshpreet931/anyview?style=social)](https://github.com/harshpreet931/anyview)

<br />

<img src="./assets/screenshot.png" width="920" alt="Anyview rendering a PDF with a thumbnail rail, search, zoom, rotate, and annotation tools" />

</div>

---

> **Status:** `v0.1` — pre-1.0, not yet published to npm. The flagship PDF experience (native render, text selection, search highlighting, annotations) is implemented; reflowable formats (DOCX, Markdown, code, …) render and are searchable. Try it now via the [playground](#run-the-playground).

## Why Anyview?

Every other React document viewer either **uses iframes** (slow, insecure, leaks your files to Microsoft/Google's online viewers, can't render private/auth-gated documents) or **supports only one format** (PDF-only, image-only). Anyview renders **everything natively in the browser** — no iframes, no server-side conversion, no clunky embeds. Private files stay client-side.

| Feature | Anyview | @cyntler/react-doc-viewer | react-pdf | react-file-viewer |
|---|:---:|:---:|:---:|:---:|
| PDF | ✅ Native (pdf.js worker) | ✅ iframe | ✅ | ✅ |
| DOCX | ✅ Native (mammoth.js) | ❌ iframe | ❌ | ✅ iframe |
| XLSX | ✅ Native (SheetJS) | ❌ iframe | ❌ | ✅ iframe |
| PPTX | ✅ Native (JSZip + XML) | ❌ | ❌ | ❌ |
| CSV/TSV | ✅ Native (PapaParse) | ❌ | ❌ | ✅ |
| Markdown | ✅ Native (react-markdown) | ❌ | ❌ | ✅ |
| Code (50+ langs) | ✅ Native (Shiki) | ❌ | ❌ | ❌ |
| HTML | ✅ Sanitized (DOMPurify) | ✅ iframe | ❌ | ✅ iframe |
| Images (8 formats) | ✅ Native | ✅ | ❌ | ✅ |
| Private files (no upload) | ✅ | ❌ public URL only | ✅ | ❌ |
| Text selection | ✅ | partial | ✅ | ❌ |
| Search + highlight | ✅ all formats | ❌ | ✅ PDF | ❌ |
| Annotations | ✅ PDF | ❌ | ❌ | ❌ |
| **No iframes** | ✅ | ❌ | ✅ | ❌ |
| **Web Workers** | ✅ Off-main-thread | ❌ | ✅ | ❌ |
| **Tree-shakeable** | ✅ Load only what you need | ❌ | ✅ | ❌ |
| **WCAG 2.2 AA** | ✅ Built-in | ❌ | ❌ | ❌ |
| **Bundle size** | **~23 kB gzip** (base) | ~40 kB | ~50 kB | ~100 kB |

## Quick Start

```bash
npm install anyview
```

Anyview keeps format parsers as **optional peer dependencies** so you ship only what you use. Add the parser for each format you need:

```bash
npm install pdfjs-dist                  # PDF
npm install mammoth                     # DOCX
npm install xlsx                        # XLSX
npm install jszip                       # PPTX
npm install papaparse                   # CSV/TSV
npm install react-markdown remark-gfm   # Markdown
npm install shiki                       # code highlighting
npm install dompurify                   # HTML / DOCX sanitization
```

```tsx
import { DocViewer } from 'anyview';
import 'anyview/styles';

function App() {
  return (
    <DocViewer
      source={{ kind: 'url', url: '/files/report.pdf' }}
      theme="auto"
      showToolbar
      showSidebar
      onDocumentLoad={(doc) => console.log(`${doc.pageCount} pages`)}
    />
  );
}
```

`source` accepts a `File`, a URL, a raw `ArrayBuffer`, or a `FileSystemFileHandle`:

```tsx
<DocViewer source={{ kind: 'file', file }} />
<DocViewer source={{ kind: 'buffer', buffer, name: 'a.docx', type: '' }} />
```

## Headline features

- **Native rendering, zero iframes** — PDF rasterizes off the main thread in a Web Worker (OffscreenCanvas → `ImageBitmap`); Office and text formats parse to real DOM.
- **Real text selection** — select and copy text directly off PDF pages (an aligned, invisible text layer over the bitmap); reflowable formats select natively.
- **Search with highlighting** — `Cmd/Ctrl+F` finds matches across **every text format**, paints highlight overlays, distinguishes the active match, and scrolls it into view. PDF uses the text layer; DOCX/Markdown/code/HTML/CSV use the CSS Custom Highlight API over real DOM text.
- **Annotations** — highlight (drag a box), free-hand ink (draw), and sticky notes on PDF pages. Stored as normalized geometry so they survive zoom; export/import via `serializeAnnotations` / `parseAnnotations`, and observe changes with `onAnnotationChange`.
- **Virtualized** — only visible pages (± overscan) are in the DOM; a byte-budgeted LRU cache keeps rendered bitmaps under a 256 MB ceiling.
- **Accessible & themeable** — ARIA roles, keyboard nav, forced-colors and reduced-motion support, four themes (`light` / `dark` / `auto` / `sepia`), full i18n via the `locale` prop.

## Supported Formats

| Format | Engine | Worker | Text select | Search | Outline | Annotations |
|---|---|:---:|:---:|:---:|:---:|:---:|
| PDF | pdf.js | ✅ | ✅ | ✅ | ✅ | ✅ |
| DOCX | mammoth.js | Planned | ✅ | ✅ | ✅ | — |
| XLSX | SheetJS | Planned | ✅ | ✅ | ✅ | — |
| PPTX | JSZip + XML | Planned | ✅ | ✅ | ✅ | — |
| CSV/TSV | PapaParse | Planned | ✅ | ✅ | — | — |
| Markdown | react-markdown + remark-gfm | — | ✅ | ✅ | ✅ | — |
| Code (50+) | Shiki | — | ✅ | ✅ | — | — |
| HTML | DOMPurify | — | ✅ | ✅ | ✅ | — |
| Images (8) | Native browser | — | — | — | — | — |
| Plain Text | Native | — | ✅ | ✅ | — | — |

> "Worker: Planned" means the format currently parses on the main thread; the architecture supports moving it to a worker without API changes.

## Run the playground

```bash
pnpm install
pnpm --filter anyview-playground dev
```

Drag any PDF / DOCX / XLSX / Markdown / image onto the page — it renders entirely client-side, nothing is uploaded.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   DocViewer                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Toolbar │  │ Sidebar  │  │  Viewer         │  │
│  │ (zoom,  │  │ (thumbs, │  │  (virtualized   │  │
│  │  search,│  │  outline,│  │  page list +    │  │
│  │  annot) │  │  attach) │  │  text/search/   │  │
│  └─────────┘  └──────────┘  │  annot layers)  │  │
│                             └─────────────────┘  │
│              ┌─────────────────┐                  │
│              │  Zustand Store  │                  │
│              │  (6 slices)     │                  │
│              └────────┬────────┘                  │
│              ┌────────┴────────┐                  │
│              │ Adapter Registry│ (fresh instance  │
│              │  (plugin arch)  │  per document)   │
│              └────────┬────────┘                  │
│     ┌──────────┬──────┴───┬──────────┐            │
│     ▼          ▼          ▼          ▼            │
│  ┌─────┐   ┌─────┐    ┌─────┐    ┌─────┐          │
│  │ PDF │   │DOCX │    │XLSX │    │ ... │          │
│  │worker│  │     │    │     │    │     │          │
│  └─────┘   └─────┘    └─────┘    └─────┘          │
│  pdfjs-dist  mammoth   xlsx       ...             │
│  (dynamic import — never in the base bundle)      │
└─────────────────────────────────────────────────┘
```

### Key design decisions

- **Plugin architecture** — each format is a self-contained adapter with a static manifest (loaded synchronously, so the toolbar knows capabilities before any parser loads) and a lazy loader (dynamic `import()` only when a matching file opens). The registry constructs a **fresh adapter instance per document**, so multiple viewers never share state.
- **Worker-offloaded** — PDF parsing and rendering run in a Web Worker via Comlink; the main thread never blocks.
- **Byte-budgeted LRU cache** — rendered page bitmaps are cached under a 256 MB budget with automatic eviction and memory-pressure shrinking.
- **WCAG 2.2 AA** — ARIA roles, keyboard navigation, screen-reader announcements, forced-colors, and reduced-motion support, built in.
- **~23 kB gzip base** — only Zustand + Comlink + @tanstack/react-virtual ship in the base; format engines load on demand as separate chunks.

## Advanced Usage

### Custom adapter

Adapters are loaded as **classes** — the module's default export is a constructor the registry instantiates per document.

```tsx
import { DocViewer, createRegistry, registerBuiltInAdapters } from 'anyview';

const registry = createRegistry();
registerBuiltInAdapters(registry);

registry.register(
  {
    id: 'epub',
    label: 'EPUB Book',
    extensions: ['epub'],
    mimeTypes: ['application/epub+zip'],
    icon: '<svg>…</svg>',
    features: { search: true, annotations: false, textSelection: true, /* … */ },
    priority: 100,
    protocolVersion: 1,
  },
  () => import('./adapters/epub'), // default-exports the EpubAdapter class
);

function App() {
  return <DocViewer source={source} registry={registry} />;
}
```

### Imperative API

```tsx
const ref = useRef<DocViewerRef>(null);

ref.current?.goToPage(5);
ref.current?.zoomIn();
ref.current?.search({ text: 'invoice', caseSensitive: false, wholeWord: false, regex: false, diacritics: false });
ref.current?.nextMatch();
await ref.current?.print();
```

### Annotations

```tsx
import { serializeAnnotations, parseAnnotations } from 'anyview';

<DocViewer
  source={source}
  onAnnotationChange={(annotations) => localStorage.setItem('notes', serializeAnnotations(annotations))}
/>
```

### Hooks & i18n

```tsx
import { useNavigation, I18nProvider, registerStrings } from 'anyview';

function PageIndicator() {
  const { currentPage, totalPages } = useNavigation();
  return <span>{currentPage + 1} / {totalPages}</span>;
}

// Localize: register a strings table, then pass locale="fr"
registerStrings('fr', frenchStrings);
<DocViewer source={source} locale="fr" />
```

## Theming

```css
.my-app .dv-root {
  --dv-toolbar-height: 40px;
  --dv-progress-bar-color: #e63946;
  --dv-sidebar-width: 240px;
}
```

Four built-in themes: `light`, `dark`, `auto` (follows system), `sepia`.

## Browser Support

| Feature | Chrome 90+ | Firefox 88+ | Safari 15+ | Edge 90+ |
|---|:---:|:---:|:---:|:---:|
| Core viewer | ✅ | ✅ | ✅ | ✅ |
| Web Workers / OffscreenCanvas | ✅ | ✅ | 17+ | ✅ |
| CSS Custom Highlight (DOM search) | ✅ | ✅ | 17.2+ | ✅ |
| File System Access | ✅ | — | — | ✅ |

Missing features degrade gracefully — e.g. main-thread canvas rendering without OffscreenCanvas, and search still counts/navigates matches where the Custom Highlight API is unavailable.

## Development

```bash
pnpm install
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm build       # vite library build
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
