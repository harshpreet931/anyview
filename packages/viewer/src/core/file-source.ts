import type { FileSource, FileSourceReader } from './types';
import { ViewerError } from './errors';

export function isSameSource(a: FileSource | undefined, b: FileSource | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'file':
      return a.file === (b as typeof a).file;
    case 'handle':
      return a.handle === (b as typeof a).handle;
    case 'url':
      return a.url === (b as typeof a).url && a.filename === (b as typeof a).filename;
    case 'buffer': {
      const o = b as typeof a;
      return a.buffer === o.buffer && a.name === o.name && a.type === o.type;
    }
  }
}

/** Normalize any FileSource into a FileSourceReader. */
export async function normalizeFileSource(
  source: FileSource,
): Promise<FileSourceReader> {
  switch (source.kind) {
    case 'file':
      return createFileReader(source.file);
    case 'handle':
      return createHandleReader(source.handle);
    case 'url':
      return createUrlReader(source.url, source.filename);
    case 'buffer':
      return createBufferReader(source.buffer, source.name, source.type);
  }
}

function createFileReader(file: File): FileSourceReader {
  return {
    meta: {
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
    },
    arrayBuffer: () => file.arrayBuffer(),
    stream: () => file.stream() as ReadableStream<Uint8Array>,
  };
}

function createBufferReader(
  buffer: ArrayBuffer,
  name: string,
  type: string,
): FileSourceReader {
  return {
    meta: { name, size: buffer.byteLength, mimeType: type || 'application/octet-stream' },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}

function createHandleReader(
  handle: FileSystemFileHandle,
): Promise<FileSourceReader> {
  return (async () => {
    const file = await handle.getFile();
    return {
      meta: {
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
      },
      arrayBuffer: () => file.arrayBuffer(),
      stream: () => file.stream() as ReadableStream<Uint8Array>,
    };
  })();
}

async function createUrlReader(
  url: string,
  filename?: string,
): Promise<FileSourceReader> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new ViewerError('NETWORK_ERROR', `Failed to fetch ${url}`, {
      cause,
      retryable: true,
    });
  }

  if (!response.ok) {
    throw new ViewerError('NETWORK_ERROR', `HTTP ${response.status} for ${url}`, {
      retryable: response.status >= 500,
    });
  }

  const blob = await response.blob();
  const name = filename || extractFilenameFromUrl(url);
  const type = blob.type || 'application/octet-stream';

  return {
    meta: { name, size: blob.size, mimeType: type },
    arrayBuffer: () => blob.arrayBuffer(),
    stream: () => blob.stream() as ReadableStream<Uint8Array>,
  };
}

function extractFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const pathname = u.pathname;
    const slash = pathname.lastIndexOf('/');
    if (slash !== -1 && slash < pathname.length - 1) {
      return decodeURIComponent(pathname.slice(slash + 1));
    }
  } catch {}
  return 'document';
}

/** Reads up to `limit` leading bytes, streaming when possible so large files aren't loaded twice. */
export async function readHead(reader: FileSourceReader, limit = 65536): Promise<Uint8Array> {
  const stream = reader.stream();
  if (!stream) return new Uint8Array(await reader.arrayBuffer()).subarray(0, limit);
  const r = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < limit) {
      const { done, value } = await r.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    r.cancel().catch(() => {});
  }
  const head = new Uint8Array(Math.min(size, limit));
  let at = 0;
  for (const c of chunks) {
    if (at >= head.length) break;
    head.set(c.subarray(0, head.length - at), at);
    at += c.byteLength;
  }
  return head;
}
