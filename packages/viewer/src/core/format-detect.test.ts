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
  });

  it('falls back to MIME type when the extension is unknown', () => {
    expect(detectFormat('blob', 'application/pdf')).toBe('pdf');
    expect(detectFormat('blob', 'image/jpeg')).toBe('image');
  });

  it('prefers extension over MIME when both are present', () => {
    expect(detectFormat('thing.pdf', 'text/plain')).toBe('pdf');
  });

  it('returns null for unknown formats', () => {
    expect(detectFormat('mystery.xyz')).toBeNull();
    expect(detectFormat('noext')).toBeNull();
    expect(detectFormat('trailingdot.')).toBeNull();
  });

  it('exposes specs', () => {
    expect(getFormatSpec('pdf')?.extensions).toContain('pdf');
    expect(getFormatSpecs().length).toBeGreaterThan(5);
  });
});
