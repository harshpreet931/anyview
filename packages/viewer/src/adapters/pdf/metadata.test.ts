import { describe, it, expect } from 'vitest';
import { PDFDateString } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfMetadata } from './metadata';

const parse = (info: Record<string, unknown>) =>
  pdfMetadata(info, (s) => PDFDateString.toDateObject(s));

describe('pdfMetadata', () => {
  it('reads PDF date strings', () => {
    const meta = parse({
      CreationDate: "D:20240315103000+02'00'",
      ModDate: 'D:20240316',
    });
    expect(meta.creationDate?.toISOString()).toBe('2024-03-15T08:30:00.000Z');
    expect(meta.modificationDate?.toISOString()).toBe('2024-03-16T00:00:00.000Z');
  });

  it('drops dates it cannot parse and fields that are missing', () => {
    const meta = parse({ Title: 'Report', CreationDate: 'yesterday', ModDate: '' });
    expect(meta).toEqual({ title: 'Report' });
  });
});
