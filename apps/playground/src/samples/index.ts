/* ============================================================
 * Sample files for the playground
 * ============================================================ */

import markdownContent from './markdown-sample.md?raw';
import textContent from './text-sample.txt?raw';
import csvContent from './csv-sample.csv?raw';
import htmlContent from './html-sample.html?raw';
import codeContent from './code-sample.ts?raw';

export interface SampleFile {
  label: string;
  fileName: string;
  mimeType: string;
  content: string;
}

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#667eea"/>
      <stop offset="0.5" stop-color="#764ba2"/>
      <stop offset="1" stop-color="#f093fb"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="200" cy="180" r="80" fill="white" fill-opacity="0.12"/>
  <circle cx="620" cy="420" r="120" fill="white" fill-opacity="0.08"/>
  <circle cx="400" cy="300" r="180" fill="white" fill-opacity="0.05"/>
  <text x="400" y="280" font-size="48" fill="white" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700">Anyview</text>
  <text x="400" y="325" font-size="20" fill="white" fill-opacity="0.7" text-anchor="middle" font-family="system-ui, sans-serif">Image Rendering Sample</text>
</svg>`;

const pdfStream1 = `BT
/F2 34 Tf
72 716 Td
(Anyview) Tj
/F1 13 Tf
0 -30 Td
(One component. Every format. Zero iframes.) Tj
/F1 11 Tf
0 -46 Td
(Anyview renders PDF, DOCX, XLSX, PPTX, CSV, Markdown, code, HTML) Tj
0 -16 Td
(and images natively in the browser - no iframes, no server round) Tj
0 -16 Td
(trips, no uploads. Your files never leave the page.) Tj
/F2 16 Tf
0 -42 Td
(Highlights) Tj
/F1 11 Tf
0 -26 Td
(- Native rendering: pdf.js runs in a Web Worker, off the main thread) Tj
0 -18 Td
(- Real text selection and search highlighting across every format) Tj
0 -18 Td
(- Annotations: highlight, free-hand ink, and sticky notes) Tj
0 -18 Td
(- Accessible WCAG 2.2 AA, four themes, and full i18n) Tj
0 -18 Td
(- Tree-shakeable, about 23 kB gzip base bundle) Tj
/F2 16 Tf
0 -42 Td
(Quick start) Tj
/F1 11 Tf
0 -26 Td
(npm install anyview) Tj
0 -18 Td
(import { DocViewer } from 'anyview';) Tj
ET`;
const pdfStream2 = `BT
/F2 20 Tf
72 716 Td
(Every format, one component) Tj
/F1 11 Tf
0 -34 Td
(PDF - native pdf.js rendering with a selectable text layer.) Tj
0 -18 Td
(DOCX - mammoth.js converts to clean, sanitized HTML.) Tj
0 -18 Td
(XLSX - SheetJS renders spreadsheets as virtualized tables.) Tj
0 -18 Td
(PPTX - slides parsed from the OOXML package.) Tj
0 -18 Td
(CSV - PapaParse, streamed into a fast table.) Tj
0 -18 Td
(Markdown - react-markdown with GitHub-flavored markdown.) Tj
0 -18 Td
(Code - Shiki highlighting for 50+ languages.) Tj
ET`;
const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 8 0 R >> >> >>
endobj
4 0 obj
<< /Length ${pdfStream1.length} >>
stream
${pdfStream1}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R /F2 8 0 R >> >> >>
endobj
7 0 obj
<< /Length ${pdfStream2.length} >>
stream
${pdfStream2}
endstream
endobj
8 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
trailer
<< /Size 9 /Root 1 0 R >>
startxref
0
%%EOF`;

const jsonContent = `{
  "name": "Anyview",
  "version": "1.0.0",
  "description": "One component. Every format. Zero iframes.",
  "license": "MIT",
  "keywords": [
    "react", "document-viewer", "pdf", "docx", "xlsx",
    "pptx", "markdown", "csv", "html", "image"
  ],
  "formats": {
    "pdf": { "engine": "pdf.js", "worker": true },
    "docx": { "engine": "mammoth.js" },
    "xlsx": { "engine": "SheetJS" },
    "pptx": { "engine": "JSZip" },
    "csv": { "engine": "PapaParse" },
    "html": { "engine": "DOMPurify" },
    "markdown": { "engine": "react-markdown" },
    "image": { "formats": ["png", "jpg", "gif", "webp", "svg", "avif"] },
    "text": { "extensions": ["txt", "log"] },
    "code": { "highlighter": "Shiki" }
  },
  "bundleSize": {
    "base": "~23 kB gzip",
    "css": "~4 kB gzip",
    "adapters": "loaded on demand, per format"
  },
  "features": [
    "virtualized-scrolling",
    "search",
    "annotations",
    "thumbnails",
    "outline",
    "dark-mode",
    "accessibility",
    "plugin-architecture"
  ]
}`;

export const SAMPLE_FILES: SampleFile[] = [
  {
    label: 'Markdown',
    fileName: 'markdown-sample.md',
    mimeType: 'text/markdown',
    content: markdownContent,
  },
  {
    label: 'Text',
    fileName: 'text-sample.txt',
    mimeType: 'text/plain',
    content: textContent,
  },
  {
    label: 'CSV',
    fileName: 'csv-sample.csv',
    mimeType: 'text/csv',
    content: csvContent,
  },
  {
    label: 'HTML',
    fileName: 'html-sample.html',
    mimeType: 'text/html',
    content: htmlContent,
  },
  {
    label: 'TypeScript',
    fileName: 'code-sample.ts',
    mimeType: 'text/typescript',
    content: codeContent,
  },
  {
    label: 'JSON',
    fileName: 'sample.json',
    mimeType: 'application/json',
    content: jsonContent,
  },
  {
    label: 'SVG',
    fileName: 'image-sample.svg',
    mimeType: 'image/svg+xml',
    content: svgContent,
  },
  {
    label: 'PDF',
    fileName: 'pdf-sample.pdf',
    mimeType: 'application/pdf',
    content: pdfContent,
  },
];

export function createSampleFileSource(sample: SampleFile) {
  const file = new File([sample.content], sample.fileName, {
    type: sample.mimeType,
  });
  return { kind: 'file' as const, file };
}
