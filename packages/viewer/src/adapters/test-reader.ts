import type { FileSourceReader } from '../core/types';

export function textReader(text: string, name: string, mimeType = ''): FileSourceReader {
  const buffer = new TextEncoder().encode(text).buffer;
  return {
    meta: { name, size: buffer.byteLength, mimeType },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}
