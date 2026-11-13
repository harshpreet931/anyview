import { describe, it, expect } from 'vitest';
import { decodeText } from './text-decode';

const bytes = (...b: number[]) => new Uint8Array(b).buffer;

function utf16(text: string, le: boolean, bom: boolean): ArrayBuffer {
  const out: number[] = bom ? (le ? [0xff, 0xfe] : [0xfe, 0xff]) : [];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    out.push(...(le ? [c & 0xff, c >> 8] : [c >> 8, c & 0xff]));
  }
  return bytes(...out);
}

describe('decodeText', () => {
  it('decodes UTF-8 and strips its BOM', () => {
    expect(decodeText(new TextEncoder().encode('héllo').buffer)).toBe('héllo');
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x68, 0x69))).toBe('hi');
  });

  it('decodes UTF-16 with a BOM', () => {
    expect(decodeText(utf16('name,qty', true, true))).toBe('name,qty');
    expect(decodeText(utf16('name,qty', false, true))).toBe('name,qty');
  });

  it('detects BOM-less UTF-16 text', () => {
    expect(decodeText(utf16('plain ascii text', true, false))).toBe('plain ascii text');
    expect(decodeText(utf16('plain ascii text', false, false))).toBe('plain ascii text');
  });

  it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
    expect(decodeText(bytes(0x63, 0x61, 0x66, 0xe9))).toBe('café');
  });

  it('honours a charset in the MIME type', () => {
    expect(decodeText(bytes(0xe9), 'text/plain; charset=ISO-8859-1')).toBe('é');
    expect(decodeText(bytes(0x68, 0x69), 'text/plain; charset=bogus')).toBe('hi');
  });
});
