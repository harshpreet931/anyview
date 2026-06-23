# Changelog

All notable changes to **anyview** are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Keyboard navigation** — arrows / Page Up·Down / Home·End / Ctrl± / sidebar toggle, scoped to focus inside the viewer so the host page keeps its own keys.
- **`useNavigation().totalPages`** convenience alias.
- **Themeable loading bar** wired to the `--dv-progress-bar-color` token.
- **FAQ** and a hosted live demo (GitHub Pages).

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
