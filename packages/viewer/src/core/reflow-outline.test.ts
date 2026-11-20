import { describe, it, expect } from 'vitest';
import { HeadingOutline } from './reflow-outline';
import type { PageDestination } from './types';

function box(el: Element, top: number, height: number, width = 800) {
  el.getBoundingClientRect = () => ({ top, height, width, left: 0, right: width, bottom: top + height, x: 0, y: top, toJSON: () => ({}) });
}

function page(zoom: number) {
  const target = document.createElement('div');
  target.innerHTML = '<h1>Notes</h1><p>text</p><h1>Notes</h1><p>more</p><h2>End</h2>';
  document.body.appendChild(target);
  Object.defineProperty(target, 'offsetWidth', { value: 800 });
  box(target, 100, 3000 * zoom, 800 * zoom);
  const [a, b, c] = Array.from(target.querySelectorAll('h1, h2'));
  box(a!, 100 + 24 * zoom, 30 * zoom);
  box(b!, 100 + 1200 * zoom, 30 * zoom);
  box(c!, 100 + 2500 * zoom, 30 * zoom);
  return { target, headings: [a!, b!, c!] };
}

const titled = (...titles: string[]) =>
  titles.map((title) => Object.assign(document.createElement('h2'), { textContent: ` ${title} ` }));

const offsets = (outline: HeadingOutline) => outline.nodes.map((n) => (n.dest as PageDestination).scrollOffset);

describe('HeadingOutline', () => {
  it('reads each offset from its own rendered heading, in page units at any zoom', () => {
    const outline = new HeadingOutline(titled('Notes', 'Notes', 'End'));
    const { target, headings } = page(1.5);
    outline.attach(target, () => headings);
    expect(outline.nodes.map((n) => n.title)).toEqual(['Notes', 'Notes', 'End']);
    expect(offsets(outline)).toEqual([24, 1200, 2500]);
    target.remove();
  });

  it('follows the page when it is drawn again', () => {
    const outline = new HeadingOutline(titled('Notes', 'Notes', 'End'));
    const first = page(1);
    outline.attach(first.target, () => first.headings);
    first.target.remove();
    const second = page(2);
    box(second.headings[2]!, 100 + 2600 * 2, 60);
    outline.attach(second.target, () => second.headings);
    expect(offsets(outline)).toEqual([24, 1200, 2600]);
    second.target.remove();
  });

  it('points at the top of the page until the page is drawn', () => {
    const outline = new HeadingOutline(titled('A', 'B'));
    expect(offsets(outline)).toEqual([0, 0]);
  });
});
