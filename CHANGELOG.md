# Changelog

All notable changes to **anyview** are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.5]

### Added
- **Password-protected PDFs** — an unlock prompt that retries on the same warm worker and reports an incorrect password.
- **Toolbar actions** — download, print, fullscreen, and document-properties buttons, each shown only when the open format supports it.
- **Document Properties** and **Password** dialogs (focus-trapped, Escape to close).
- **`Ctrl`/`Cmd`+`F`** opens the in-document search.
- **`persistKey` prop** — give each `<DocViewer>` on a page a distinct key so their saved zoom/theme/sidebar preferences don't collide.
- **Keyboard navigation** — arrows / Page Up·Down / Home·End / Ctrl± / sidebar toggle, scoped to focus inside the viewer so the host page keeps its own keys.
- **`useNavigation().totalPages`** convenience alias.
- **Themeable loading bar** wired to the `--dv-progress-bar-color` token.
- **FAQ** and a hosted live demo (GitHub Pages).

### Fixed
- **PDF worker 404 for npm consumers** — the worker URL was absolute and broke outside the playground; it now resolves relative to the package.
- **Download only worked for PDFs** — every open document can now be downloaded (the source is re-read for non-PDF formats).
- **Search was unreachable for XLSX/PPTX** even though it was supported — the toolbar now exposes it.
- **Concurrent searches clobbered each other's highlights** across multiple viewers or a multi-page reflowable document.
- **Scroll ↔ page indicator could oscillate** while paging quickly.
- **Object URLs leaked and downloads could be cancelled** — fixed revoke timing for both download and print.
- **PDF outline links jumped to the wrong page** — named destinations are resolved and the full bookmark tree is built.
- **Per-document state** (page, rotation, search, annotations) now resets when a new file is opened.
- **High-DPI pages** could show a blurry cached render — device pixel ratio is now part of the cache key.
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
- **Thumbnails for every format** — real page previews (canvas for PDF/images, a scaled DOM render for DOCX, Markdown, code, CSV, HTML, and PPTX).

### Fixed
- **Images rendered blank** — the adapter now draws decoded images onto the page `<canvas>` (PageRenderer treats images as a canvas format).
- **Dark mode readability** — reflowable documents render as dark ink on a white "paper" surface in every UI theme, like a PDF page.
- **PPTX zoom** — fixed a double-scale bug that overflowed slides when zoomed.

## [0.1.3]

### Fixed
- **PDF/image thumbnails** showed blank placeholders — now render real previews lazily as they scroll into view.

## [0.1.2]

### Added
- README is now published to (and shown on) the npm package page.

## [0.1.1]

### Fixed
- Wired the PDF worker correctly (Comlink + pdf.js) and reflowable search highlighting.

## [0.1.0]

### Added
- Initial release: a single React component that renders **PDF, DOCX, XLSX, PPTX, CSV, Markdown, code, HTML, and images natively in the browser** — no iframes, no uploads.
- Real text selection, cross-format search with highlighting, PDF annotations (highlight / ink / sticky-note), thumbnails, outline, four themes, i18n, and a plugin-based adapter architecture.
