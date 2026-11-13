import { describe, it, expect } from 'vitest';
import { imageMimeType } from './ImageAdapter';

const enc = (s: string) => new TextEncoder().encode(s).buffer;
const SVG = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

describe('imageMimeType', () => {
  it('recovers image/svg+xml for SVGs served without a usable type', () => {
    expect(imageMimeType('logo.svg', '', enc(SVG))).toBe('image/svg+xml');
    expect(imageMimeType('blob', 'application/octet-stream', enc(SVG))).toBe('image/svg+xml');
    expect(imageMimeType('icon', 'text/xml', enc(SVG))).toBe('image/svg+xml');
  });

  it('keeps a specific type untouched', () => {
    expect(imageMimeType('a.png', 'image/png', enc('x'))).toBe('image/png');
    expect(imageMimeType('a.bin', '', enc('\x89PNG'))).toBe('');
  });
});
