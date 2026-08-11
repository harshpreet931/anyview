# Changelog

All notable changes to **anyview** are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.4]

### Fixed
- **`onDocumentLoad` and `onError` fire once per load, not once per render.** Both were driven by effects that listed the callback prop in their dependencies, so passing an inline arrow (`onDocumentLoad={(m) => …}` - the common case) re-ran the effect on every parent render and re-announced a document that had already loaded. They now fire from the store transition itself.
- **A failed attachment download no longer becomes an uncaught promise rejection.** Clicking an attachment whose data could not be read rejected with nothing attached to catch it, which no React error boundary can intercept. The object URL is now also released if the download click throws.
- **Pinch-to-zoom no longer writes to a closed viewer.** Unmounting within 90 ms of a ctrl+wheel gesture left the settle timer armed, so the deferred commit ran afterwards and pushed a zoom into a store the component no longer owned.
- **Thumbnails and outline rows keep their identity when the list changes.** Both were keyed by array position, so a filtered or reordered list could hand one row's render state to another. Thumbnails key on the page's own index; outline nodes, which carry no id, derive one from title plus destination.
- **Marquee zoom state can't leak from an uncommitted render.** The live zoom value was written to a ref during render, which React is free to replay or discard.

### Performance
- **PDFs open faster.** Reading page dimensions walked `getPage()` one page at a time, and the outline resolved each bookmark destination serially (recursing into children serially on top of that). Both now resolve in parallel, so open time no longer scales with a round trip per page.
- **PDF text search scans pages in parallel** instead of one page per await. Note the trade-off: a search superseded by the next keystroke previously stopped mid-scan, and now runs to completion in the worker before its result is discarded. The 180 ms input debounce bounds how often that happens.
- **PPTX decks parse faster** - slide XML is unzipped and parsed for all slides at once rather than one slide per await.
- **Markdown and Jupyter files render sooner on first open.** Their renderer dependencies (`react`, `react-dom/server`, `react-markdown`, `remark-gfm`) were awaited one at a time, waterfalling four chunk fetches that share no data.
- **Toolbar updates touch less of the tree.** It is now five components that each subscribe only to what they render, so changing the zoom no longer re-renders the page input or the annotation tools.

### Accessibility
- **Native elements replace ARIA roles on generic containers**: the sidebar is an `<aside>`, the search bar a `<search>`, the loading indicator a `<progress>`, and the thumbnail list a `<ul>`. The thumbnail list was the substantive fix - it declared `role="list"` over bare `<button>` children with no list items in between, so its list semantics were already broken for screen readers.

### Security
- **`pdfjs-dist` upgraded to `^6.2.108`** (from `^6.1.200`), which scores 99/100 on Socket's supply-chain axis against 31/100 for the previous build. This raises the optional peer dependency floor: consumers pinned to pdf.js 6.1 need to update. Note that pdf.js 6.2 declares `engines: ">=22.13.0 || >=24"`, so Node 18/20 installs may warn.
- **Document HTML reaches the DOM through a single checked sink.** Every reflowable adapter (CSV, DOCX, HTML, Jupyter, Markdown, XLSX) assigned `innerHTML` from a field sanitized several methods away. Markup is now typed `SafeHtml`, which only an escape or `DOMPurify.sanitize()` can produce, and is parsed into an inert `<template>` before its nodes are adopted. This is defence in depth and a compile-time guarantee - all six values were already sanitized, so no live XSS is fixed here.

## [0.2.3]

### Added
- **`PdfAdapter.configureAssets(baseUrl)`**: point the PDF worker at a custom location for pdf.js's CMap, standard-font, WASM, and ICC data, for hosts that serve those assets from somewhere other than the package's own `dist/pdfjs/`.

### Fixed
- **PDFs render correctly when installed from npm.** 0.2.2 fixed the missing pdf.js CMap/standard-font/WASM/ICC data for the demo app, but the published package never shipped those files, so real installs still drew CID-keyed and non-embedded glyphs as `.notdef` boxes. The assets now ship inside the package and the worker resolves them relative to its own URL, with `PdfAdapter.configureAssets()` as an override.
- **TypeScript `NodeNext` consumers compile again.** The generated declarations used extension-less relative imports, which `moduleResolution: node16`/`nodenext` rejects (`TS2834`); a minimal consumer failed with 51 errors. Declaration imports now carry explicit `.js` specifiers.
- **Pages with their own `/Rotate` display upright.** A PDF's intrinsic rotation (scanned or phone-captured pages) was replacing rather than composing with the toolbar rotation, so such pages rendered sideways and rotating appeared to snap them back. The canvas, text layer, search coordinates, and page sizing now all compose intrinsic and applied rotation.
- **Cancelling the password prompt no longer leaves a broken viewer.** Cancelling while an attempt was in flight let the stale parse finish and mark the viewer `loaded` against an already-disposed adapter; rapid double-submits could also start two parses on one adapter.
- **Stale search results can't reappear.** Closing or replacing a document left an in-flight search running, which then repopulated its results onto the empty (or newly opened) document.
- **Horizontal scroll mode spaces pages correctly.** The virtualizer measured each page along the wrong axis, leaving a gap at 0° and overlapping pages at 90°, and corrupting the total scroll width and page navigation.
- **Large plain-text files open.** An ordinary ~300 KB file (150k lines) threw a `RangeError` while measuring its longest line.
- **Cancelled loads no longer leak.** Closing a document before its parse finished left the in-flight adapter, and its PDF worker, undisposed.
- **A failed document swap no longer exposes the previous document.** Opening an invalid file over a loaded one entered the error state but kept the old document, source, and annotations reachable through `getDocument()`, download, the annotation API, and the Properties dialog.
- **Heading navigation works in HTML and DOCX.** Outline offsets were read from a detached parse tree that never lays out, so every heading reported an offset of 0 and clicking it did nothing.
- **Uppercase `.TSV` files parse as tab-separated** instead of collapsing each row into a single cell.
- **MIME types carrying parameters are detected**, so an extensionless URL response of `text/plain; charset=utf-8` resolves instead of being reported as unsupported.

### Changed
- Runtime dependency minimums raised within their existing majors (`@tanstack/react-virtual` ^3.14.5, `comlink` ^4.4.2, `zustand` ^5.0.14). No peer dependency ranges changed.
- Internal toolchain upgraded to TypeScript 6, Vite 8, ESLint 10, and Vitest 4; the library build now uses Vite's native `oxc` minifier instead of the deprecated esbuild path.

## [0.2.2]

### Fixed
- **Real-world PDFs no longer render as empty boxes.** Government/CID-font PDFs (e.g. Indian ITR, electoral rolls, Indic scripts) and PDFs with non-embedded standard fonts showed every glyph as a `.notdef` box because pdf.js was never given its CMap, standard-font, WASM, and ICC data. These are now bundled and served, and the worker is configured to fetch them.
- **Rotating a PDF no longer blanks or fails to rotate.** Two bugs: cached pages repainted through a `2d` context on a canvas already bound to `bitmaprenderer` (which returns `null`), blanking the page on any cache re-hit (e.g. rotating a full cycle); and pdf.js 6's default DOM canvas factory needs `document`, which doesn't exist in the worker, so rotated/complex renders silently failed. The worker now paints via `2d` throughout and uses an `OffscreenCanvas` factory.

### Changed
- **Upgraded pdf.js (`pdfjs-dist`) from 4.x to 6.1.200.** The `pdfjs-dist` peer dependency is now `^6.1` (a breaking bump for consumers pinned to pdf.js 4/5). The worker runs fully off the main thread with `useWorkerFetch`, `disableFontFace`, and an OffscreenCanvas-backed canvas factory.

## [0.2.1]

### Security
- **Jupyter output XSS**: notebook image outputs validate their base64 data before it is interpolated into a `src` attribute, so a crafted value can no longer break out and inject markup on open.
- **Document images can't reach the network**: `<img src="http://…">` (HTML/DOCX) and `![](http://…)` (Markdown/notebook) are stripped to inline `data:`/fragment sources only, blocking open-time beacons and internal-host probes.
- **Oversized documents are refused**: reflowable adapters reject files over 24 MB before their synchronous whole-document transform, so a pathological input can't freeze the page.

### Fixed
- **PDF rotation** keeps the page aspect ratio at 90°/270°; the canvas box and reported size now match the rotated bitmap instead of stretching it.
- **Multi-viewer search isolation**: DOM-search state is keyed per viewer instance, so two `<DocViewer>`s on one page no longer leak matches into each other.
- **Keyboard shortcuts** are scoped to each viewer's root, and navigation keys act only when the content region has focus (not when a toolbar control is focused).
- **Controlled `page` prop** set before the document finishes loading is applied on load instead of being dropped.
- **Buffer sources** are no longer detached: opening a `{ kind: 'buffer' }` source keeps the caller's `ArrayBuffer` intact.
- **High-DPI cache budget**: the page-cache byte estimate accounts for device-pixel-ratio squared, so 2× displays no longer hold ~4× the intended memory.
- **Outline `scrollOffset`** is honored, so jumping to a heading inside a reflowable document scrolls to it.

### Performance
- **Zoom gestures** scale the page live with a CSS transform and rasterize once when the gesture settles, instead of re-rendering on every wheel/pinch event.
- **XLSX** sheets are sanitized and styled once at parse rather than on every render.
- **Search** is debounced as the user types.

### Accessibility
- The sidebar **resize separator** is keyboard operable: focusable, Arrow keys to resize, Home/End to the bounds, with an `aria-value` range.

### Internationalization
- The sidebar, empty/loading/error states, dialogs, and the screen-reader page announcer read their strings from the locale table, so a registered locale localizes the whole UI (not just the toolbar).

## [0.2.0]

### Added
- **Jupyter notebook (`.ipynb`) viewer**: renders markdown cells, syntax-highlighted code, and saved outputs (stdout/stderr, results, `data:` images, sanitized HTML/SVG, and error tracebacks) natively. No kernel, no Python, no upload.
- **Zoom UX**: Ctrl/Cmd+wheel zoom anchored at the cursor (also covers trackpad pinch), two-finger **touch pinch**, **marquee zoom-to-selection** (drag a box), and **fit-page / fit-width / actual-size** modes; the zoom control shows the live percentage.
- **Two-page / book-spread layout**: render facing pairs (Single / Two-up / Cover) for multi-page documents.
- **Imperative annotation API**: `addAnnotation` / `updateAnnotation` / `deleteAnnotation` / `setAnnotations` / `clearAnnotations` / `setActiveTool` plus `exportAnnotations()` / `importAnnotations()` (versioned sidecar JSON) on the `DocViewer` ref.
- **More annotation tools**: rectangle, ellipse, line, arrow (with arrowhead), and free-text, alongside highlight / ink / sticky-note.
- **Richer callbacks**: `onPageChange`, `onZoom`, `onSearchResult`, `onVisiblePagesChange`, `onSelectionChange`, plus a controlled `page` prop.
- **Working empty state**: click to browse or drop a file to open it (drag-and-drop / file picker), through the store.

### Fixed
- **Viewer container is a bounded scroll region**: it previously grew to its content height (an inert `flex: 1`), which clipped multi-page documents with no scrollbar and broke fit-to-page.
- **Fit modes are spread-aware**: fit-width / fit-page now account for both pages in a two-up spread instead of overflowing the width.

## [0.1.6]

### Fixed
- **Documents bled across loads**: opening a new document over a loaded one could show the previous one's cached pages and leaked its PDF worker. The old document is now torn down on open.
- **Spreadsheet/slide search**: multi-page reflowable search (XLSX, PPTX) reported only one page's matches and couldn't move between pages; matches are now aggregated in page order with the correct page index.
- **Large code files** no longer crash the viewer (a stack overflow when measuring the longest line).
- **PPTX slides** are ordered by the presentation's slide order, not their `slideN.xml` filenames.
- **Legacy formats**: `.doc`, `.ppt`, and `.rtf` now report a clean "unsupported" state instead of failing or rendering raw control codes (`.xls` still works via SheetJS).
- **`onAnnotationChange`** now fires when annotations are cleared on document open/close.
- **Sidebar**: Outline/Attachments tabs appear only when the document has them, and the resize handle is now rendered so the sidebar can actually be resized.
- **PDF search** honors cancellation, so a superseded query stops walking pages instead of running to completion.
- **pdf.js loading task** is destroyed when a parse fails (wrong password / corrupt file), freeing worker resources.

### Security
- Strip network-reaching CSS (`url()`, `@import`, `expression()`) from sanitized `style` attributes to block zero-click exfiltration and internal-host probing (HTML/DOCX/XLSX).
- Force `rel="noopener noreferrer"` on `target="_blank"` links inside documents.
- Route PPTX slide HTML through the shared sanitizer.

### Compatibility
- **Next.js App Router**: the package ships a `'use client'` boundary on its entry and guards `localStorage` during SSR, so it works in Server-Component apps.
- A `persistKey` prop (added in 0.1.5) isolates saved preferences when multiple viewers share a page.

## [0.1.5]

### Added
- **Password-protected PDFs**: an unlock prompt that retries on the same warm worker and reports an incorrect password.
- **Toolbar actions**: download, print, fullscreen, and document-properties buttons, each shown only when the open format supports it.
- **Document Properties** and **Password** dialogs (focus-trapped, Escape to close).
- **`Ctrl`/`Cmd`+`F`** opens the in-document search.
- **`persistKey` prop**: give each `<DocViewer>` on a page a distinct key so their saved zoom/theme/sidebar preferences don't collide.
- **Keyboard navigation**: arrows / Page Up·Down / Home·End / Ctrl± / sidebar toggle, scoped to focus inside the viewer so the host page keeps its own keys.
- **`useNavigation().totalPages`** convenience alias.
- **Themeable loading bar** wired to the `--dv-progress-bar-color` token.
- **FAQ** and a hosted live demo (GitHub Pages).

### Fixed
- **PDF worker 404 for npm consumers**: the worker URL was absolute and broke outside the playground; it now resolves relative to the package.
- **Download only worked for PDFs**: every open document can now be downloaded (the source is re-read for non-PDF formats).
- **Search was unreachable for XLSX/PPTX** even though it was supported; the toolbar now exposes it.
- **Concurrent searches clobbered each other's highlights** across multiple viewers or a multi-page reflowable document.
- **Scroll ↔ page indicator could oscillate** while paging quickly.
- **Object URLs leaked and downloads could be cancelled**: fixed revoke timing for both download and print.
- **PDF outline links jumped to the wrong page**: named destinations are resolved and the full bookmark tree is built.
- **Per-document state** (page, rotation, search, annotations) now resets when a new file is opened.
- **High-DPI pages** could show a blurry cached render; device pixel ratio is now part of the cache key.
- **Extensionless files** (Dockerfile, Makefile, …) are detected as code.
- **Wrong-password detection** for PDFs is now case-insensitive.
- **Clearer error** that names the missing package when an optional parser fails to load.
- HTML sanitizer no longer allows `<style>`, preventing a document from restyling the host page.
- Annotation highlights no longer block selecting the text beneath them in reading mode.
- Overly long or runaway search queries are capped so they can't freeze the page.

### Accessibility
- Live region announces the current page ("Page X of N") to screen readers.
- Sidebar view switcher uses proper `tablist` / `tab` / `tabpanel` roles.
- Fullscreen now uses the real Fullscreen API, staying in sync with the button and Esc.

### Internal
- `LICENSE` is included in the published package; CSS asset de-duplicated.
- Page cache trims its least-recently-used renders when the tab is backgrounded.

## [0.1.4]

### Added
- **Thumbnails for every format**: real page previews (canvas for PDF/images, a scaled DOM render for DOCX, Markdown, code, CSV, HTML, and PPTX).

### Fixed
- **Images rendered blank**: the adapter now draws decoded images onto the page `<canvas>` (PageRenderer treats images as a canvas format).
- **Dark mode readability**: reflowable documents render as dark ink on a white "paper" surface in every UI theme, like a PDF page.
- **PPTX zoom**: fixed a double-scale bug that overflowed slides when zoomed.

## [0.1.3]

### Fixed
- **PDF/image thumbnails** showed blank placeholders, which now render real previews lazily as they scroll into view.

## [0.1.2]

### Added
- README is now published to (and shown on) the npm package page.

## [0.1.1]

### Fixed
- Wired the PDF worker correctly (Comlink + pdf.js) and reflowable search highlighting.

## [0.1.0]

### Added
- Initial release: a single React component that renders **PDF, DOCX, XLSX, PPTX, CSV, Markdown, code, HTML, and images natively in the browser**: no iframes, no uploads.
- Real text selection, cross-format search with highlighting, PDF annotations (highlight / ink / sticky-note), thumbnails, outline, four themes, i18n, and a plugin-based adapter architecture.
