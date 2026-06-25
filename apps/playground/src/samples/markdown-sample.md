# Anyview: Universal Document Viewer

## Features

- **10 formats** supported out of the box: PDF, DOCX, XLSX, PPTX, CSV, HTML, Markdown, Code, Images, Text
- **Native rendering**: no iframes, no server-side conversion
- **Plugin architecture**: add your own format adapter
- **Virtualized scrolling** with @tanstack/react-virtual
- **WCAG 2.2 AA** accessible
- **Dark / Light / Sepia** themes
- **Tree-shakeable**: base bundle < 10 kB gzip

## Quick Start

```bash
pnpm add anyview
```

```tsx
import { DocViewer } from 'anyview';

<DocViewer source={{ kind: 'url', url: '/report.pdf' }} />
```

## Architecture

| Layer | Technology |
|-------|-----------|
| State | Zustand v5 |
| Virtualization | @tanstack/react-virtual |
| Worker RPC | Comlink |
| Rendering | Canvas + DOM |
| Parsing | Per-format (lazy-loaded) |

> Built with ❤️ for the React community.
