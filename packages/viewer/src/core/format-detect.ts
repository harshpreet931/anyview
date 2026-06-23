/* ============================================================
 * Format Detection
 * Extension/MIME → FormatId mapping with ambiguity resolution.
 * ============================================================ */

import type { FormatId, FormatSpec } from './types';

const FORMAT_SPECS: readonly FormatSpec[] = [
  {
    id: 'pdf',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
  },
  {
    id: 'docx',
    extensions: ['docx', 'doc'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
  },
  {
    id: 'xlsx',
    extensions: ['xlsx', 'xls'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },
  {
    id: 'pptx',
    extensions: ['pptx', 'ppt'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ],
  },
  {
    id: 'image',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'],
    mimeTypes: [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml',
      'image/avif',
    ],
  },
  {
    id: 'markdown',
    extensions: ['md', 'markdown', 'mdx'],
    mimeTypes: ['text/markdown', 'text/x-markdown'],
  },
  {
    id: 'code',
    extensions: [
      'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
      'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
      'css', 'scss', 'less', 'vue', 'svelte', 'php',
      'sh', 'bash', 'zsh', 'sql', 'dockerfile',
    ],
    mimeTypes: [
      'text/typescript', 'text/javascript', 'application/json',
      'text/yaml', 'text/x-yaml', 'text/python',
      'text/x-shellscript', 'text/sql',
    ],
  },
  {
    id: 'csv',
    extensions: ['csv', 'tsv'],
    mimeTypes: ['text/csv', 'text/tab-separated-values'],
  },
  {
    id: 'html',
    extensions: ['html', 'htm'],
    mimeTypes: ['text/html'],
  },
  {
    id: 'text',
    extensions: ['txt', 'log', 'rtf'],
    mimeTypes: ['text/plain', 'text/rtf'],
  },
];

const EXTENSION_MAP = new Map<string, FormatId>();
const MIME_MAP = new Map<string, FormatId>();

for (const spec of FORMAT_SPECS) {
  for (const ext of spec.extensions) {
    const lower = ext.toLowerCase();
    if (!EXTENSION_MAP.has(lower)) {
      EXTENSION_MAP.set(lower, spec.id);
    }
  }
  for (const mime of spec.mimeTypes) {
    const lower = mime.toLowerCase();
    if (!MIME_MAP.has(lower)) {
      MIME_MAP.set(lower, spec.id);
    }
  }
}

/**
 * Detect the best-matching FormatId for a file.
 * Checks extension first, then MIME type.
 */
export function detectFormat(
  filename: string,
  mimeType?: string,
): FormatId | null {
  const ext = extractExtension(filename);
  if (ext) {
    const byExt = EXTENSION_MAP.get(ext);
    if (byExt) return byExt;
  }

  if (mimeType) {
    const byMime = MIME_MAP.get(mimeType.toLowerCase());
    if (byMime) return byMime;
  }

  return null;
}

/**
 * Get all registered format specs.
 */
export function getFormatSpecs(): readonly FormatSpec[] {
  return FORMAT_SPECS;
}

/**
 * Get the format spec for a specific FormatId.
 */
export function getFormatSpec(id: FormatId): FormatSpec | undefined {
  return FORMAT_SPECS.find((s) => s.id === id);
}

function extractExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}
