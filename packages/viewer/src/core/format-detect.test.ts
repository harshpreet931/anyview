import { describe, it, expect } from 'vitest';
import { detectFormat, getFormatSpec, getFormatSpecs } from './format-detect';

describe('detectFormat', () => {
  it('detects by extension', () => {
    expect(detectFormat('report.pdf')).toBe('pdf');
    expect(detectFormat('notes.md')).toBe('markdown');
    expect(detectFormat('data.csv')).toBe('csv');
    expect(detectFormat('sheet.xlsx')).toBe('xlsx');
    expect(detectFormat('photo.PNG')).toBe('image');
    expect(detectFormat('main.tsx')).toBe('code');
    expect(detectFormat('analysis.ipynb')).toBe('ipynb');
  });

  it('falls back to MIME type when the extension is unknown', () => {
    expect(detectFormat('blob', 'application/pdf')).toBe('pdf');
    expect(detectFormat('blob', 'image/jpeg')).toBe('image');
  });

  it('prefers extension over MIME when both are present', () => {
    expect(detectFormat('thing.pdf', 'text/plain')).toBe('pdf');
  });

  it('detects MIME types that carry parameters', () => {
    expect(detectFormat('download', 'text/plain; charset=utf-8')).toBe('text');
    expect(detectFormat('download', 'application/pdf;charset=binary')).toBe('pdf');
    expect(detectFormat('blob', 'TEXT/HTML; charset=UTF-8')).toBe('html');
  });

  it('returns null for unknown formats', () => {
    expect(detectFormat('mystery.xyz')).toBeNull();
    expect(detectFormat('noext')).toBeNull();
    expect(detectFormat('trailingdot.')).toBeNull();
  });

  it('does not claim legacy formats it cannot parse', () => {
    expect(detectFormat('legacy.doc')).toBeNull();
    expect(detectFormat('deck.ppt')).toBeNull();
    expect(detectFormat('memo.rtf')).toBeNull();
    expect(detectFormat('book.xls')).toBe('xlsx');
  });

  it('exposes specs', () => {
    expect(getFormatSpec('pdf')?.extensions).toContain('pdf');
    expect(getFormatSpecs().length).toBeGreaterThan(5);
  });

  it('trusts the file signature over a misleading name', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj');
    expect(detectFormat('download.php', 'text/html', pdf)).toBe('pdf');
    expect(detectFormat('noext', undefined, pdf)).toBe('pdf');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectFormat('avatar', 'application/octet-stream', png)).toBe('image');
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(detectFormat('photo.txt', 'text/plain', jpg)).toBe('image');
  });

  it('recognises OOXML packages from their entry names', () => {
    const zip = (entry: string) =>
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(26).fill(0), ...new TextEncoder().encode(entry)]);
    expect(detectFormat('file', undefined, zip('word/document.xml'))).toBe('docx');
    expect(detectFormat('file', undefined, zip('xl/workbook.xml'))).toBe('xlsx');
    expect(detectFormat('file', undefined, zip('ppt/presentation.xml'))).toBe('pptx');
  });

  it('prefers a specific server Content-Type over a script-like extension', () => {
    expect(detectFormat('view.php', 'application/pdf')).toBe('pdf');
    expect(detectFormat('export.php', 'text/csv; charset=utf-8')).toBe('csv');
    expect(detectFormat('page.php', 'text/plain')).toBe('code');
  });

  it('treats extensionless readable text as plain text', () => {
    const text = new TextEncoder().encode('just some notes\nsecond line');
    expect(detectFormat('NOTES', 'application/octet-stream', text)).toBe('text');
    expect(detectFormat('blob', undefined, new Uint8Array([0, 1, 2, 3, 0, 0]))).toBeNull();
  });
});
