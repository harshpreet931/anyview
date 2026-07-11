import { describe, it, expect } from 'vitest';
import { headingScrollOffset } from './reflow-outline';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('headingScrollOffset', () => {
  it('is 0 for a heading at the very top', () => {
    const doc = parse('<h1>Top</h1><p>body</p>');
    const h = doc.querySelector('h1')!;
    expect(headingScrollOffset(doc, h)).toBe(0);
  });

  it('produces increasing, non-zero offsets for later headings', () => {
    const filler = 'x'.repeat(2000);
    const doc = parse(
      `<h1>A</h1><p>${filler}</p><h2>B</h2><p>${filler}</p><h3>C</h3>`,
    );
    const [a, b, c] = Array.from(doc.querySelectorAll('h1, h2, h3'));
    const oa = headingScrollOffset(doc, a!);
    const ob = headingScrollOffset(doc, b!);
    const oc = headingScrollOffset(doc, c!);
    expect(oa).toBe(0);
    expect(ob).toBeGreaterThan(0);
    expect(oc).toBeGreaterThan(ob);
  });

  it('orders duplicate heading text by document position', () => {
    const filler = 'y'.repeat(1600);
    const doc = parse(`<h2>Same</h2><p>${filler}</p><h2>Same</h2>`);
    const [first, second] = Array.from(doc.querySelectorAll('h2'));
    expect(headingScrollOffset(doc, second!)).toBeGreaterThan(
      headingScrollOffset(doc, first!),
    );
  });
});
