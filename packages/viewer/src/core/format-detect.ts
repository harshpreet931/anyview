import type { FormatId, FormatSpec } from './types';

const FORMAT_SPECS: readonly FormatSpec[] = [
  {
    id: 'pdf',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
  },
  {
    id: 'docx',
    // Only OOXML .docx - mammoth cannot read the legacy binary .doc.
    extensions: ['docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
    // Only OOXML .pptx - the JSZip+XML parser can't read the legacy binary .ppt.
    extensions: ['pptx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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
    id: 'ipynb',
    extensions: ['ipynb'],
    mimeTypes: ['application/x-ipynb+json'],
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
    // No 'rtf' - it would render raw RTF control words as plain text, not report unsupported.
    extensions: ['txt', 'log'],
    mimeTypes: ['text/plain'],
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

const EXTENSIONLESS_MAP = new Map<string, FormatId>([
  ['dockerfile', 'code'],
  ['makefile', 'code'],
  ['rakefile', 'code'],
  ['gemfile', 'code'],
  ['license', 'text'],
  ['readme', 'markdown'],
]);

const GENERIC_MIMES = new Set(['', 'application/octet-stream', 'text/plain', 'binary/octet-stream']);
const NAME_ONLY_FORMATS = new Set<FormatId>(['code', 'text']);

const startsWith = (head: Uint8Array, sig: readonly number[], at = 0) =>
  head.length >= at + sig.length && sig.every((b, i) => head[at + i] === b);

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

function includes(head: Uint8Array, needle: readonly number[]): boolean {
  outer: for (let i = 0; i + needle.length <= head.length; i++) {
    for (let j = 0; j < needle.length; j++) if (head[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const OOXML_ENTRIES: ReadonlyArray<[number[], FormatId]> = [
  [ascii('word/'), 'docx'],
  [ascii('xl/'), 'xlsx'],
  [ascii('ppt/'), 'pptx'],
];

/** Identifies a format from its leading bytes, for formats with a reliable signature. */
export function sniffFormat(head: Uint8Array): FormatId | null {
  if (startsWith(head, ascii('%PDF-'))) return 'pdf';
  if (
    startsWith(head, [0x89, 0x50, 0x4e, 0x47]) ||
    startsWith(head, [0xff, 0xd8, 0xff]) ||
    startsWith(head, ascii('GIF8')) ||
    (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)) ||
    startsWith(head, ascii('ftypavif'), 4)
  ) {
    return 'image';
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    for (const [entry, format] of OOXML_ENTRIES) if (includes(head, entry)) return format;
  }
  return null;
}

function looksLikeText(head: Uint8Array): boolean {
  const sample = head.subarray(0, 4096);
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  return control / sample.length < 0.02;
}

/**
 * Picks a format from the file name, MIME type and (optionally) the first bytes.
 * A recognised byte signature wins; a specific MIME type beats a script-like or
 * plain-text extension (e.g. `download.php` served as `application/pdf`).
 */
export function detectFormat(
  filename: string,
  mimeType?: string,
  head?: Uint8Array,
): FormatId | null {
  const sniffed = head ? sniffFormat(head) : null;
  if (sniffed) return sniffed;

  const ext = extractExtension(filename);
  const byName = ext
    ? (EXTENSION_MAP.get(ext) ?? null)
    : (EXTENSIONLESS_MAP.get((filename.split(/[\\/]/).pop() ?? '').toLowerCase()) ?? null);

  const bareMime = (mimeType ?? '').split(';')[0]!.trim().toLowerCase();
  const byMime = MIME_MAP.get(bareMime) ?? null;

  if (byName && byMime && byMime !== byName && NAME_ONLY_FORMATS.has(byName) && !GENERIC_MIMES.has(bareMime)) {
    return byMime;
  }
  if (byName) return byName;
  if (byMime) return byMime;
  if (head && looksLikeText(head)) return 'text';
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

export function extractExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}
