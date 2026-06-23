/* ============================================================
 * File Source Abstraction
 * Normalizes any FileSource into a FileSourceReader.
 * ============================================================ */

import type { FileSource, FileSourceReader } from './types';
import { ViewerError } from './errors';

/**
 * Normalize any FileSource into a FileSourceReader.
 * This is the single entry point adapters use.
 */
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
  } catch {
    // ignore
  }
  return 'document';
}
