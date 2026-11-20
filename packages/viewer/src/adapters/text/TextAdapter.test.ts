import { afterEach, describe, it, expect } from 'vitest';
import { TextAdapter } from './TextAdapter';
import { textReader } from '../test-reader';
import type { DocumentModel, RenderContext } from '../../core/types';
import { testViewer, type TestViewer } from '../../core/rows/test-viewer';

const QUERY = { caseSensitive: false, wholeWord: false, regex: false, diacritics: false };

function ctx(model: DocumentModel, target: HTMLElement, print = false): RenderContext {
  return {
    page: model.pages[0]!,
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
    ...(print ? { print } : {}),
  };
}

const log = (lines: number, special: Record<number, string> = {}) =>
  Array.from({ length: lines }, (_, i) => special[i] ?? `2026-11-20 INFO request ${i} handled`).join('\n');

describe('TextAdapter', () => {
  it('parses a small file into one page sized to its content', async () => {
    const adapter = new TextAdapter();
    const model = await adapter.parse(
      textReader('hello\nworld!!\n', 'big.txt', 'text/plain'),
      new AbortController().signal,
    );
    expect(model.format).toBe('text');
    expect(model.pageCount).toBe(1);
    expect(model.pages[0]!.width).toBeGreaterThanOrEqual(400);
  });

  it('parses a file with 150k lines without a call-stack RangeError', async () => {
    const adapter = new TextAdapter();
    const text = Array.from({ length: 150_000 }, (_, i) => `line ${i}`).join('\n');
    const model = await adapter.parse(textReader(text, 'big.txt', 'text/plain'), new AbortController().signal);
    expect(model.pageCount).toBe(1);
    expect(model.pages[0]!.height).toBeGreaterThan(150_000);
  });

  it('makes the page wide enough for its longest line at a monospace advance, so no line wraps', async () => {
    const long = 'x'.repeat(300);
    const adapter = new TextAdapter();
    const model = await adapter.parse(textReader(`short\n${long}\n`, 'wide.log', 'text/plain'), new AbortController().signal);
    expect(model.pages[0]!.width).toBeGreaterThanOrEqual(300 * 14 * 0.6 + 32);
    expect(model.pages[0]!.height).toBe(32 + 3 * 20);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(model, target));
    const line = target.querySelector<HTMLElement>('[data-dv-unit="1"]')!;
    expect(line.textContent).toBe(long);
    expect(line.classList.contains('dv-line')).toBe(true);
    expect(target.querySelector('pre')!.style.whiteSpace).toBe('');
  });

  describe('in the viewer', () => {
    let viewer: TestViewer;
    afterEach(() => viewer?.dispose());

    async function open(text: string) {
      viewer = testViewer(600);
      const adapter = new TextAdapter();
      const model = await adapter.parse(textReader(text, 'big.log', 'text/plain'), new AbortController().signal);
      const target = document.createElement('div');
      viewer.container.appendChild(target);
      await adapter.renderPage(ctx(model, target));
      return { adapter, target };
    }

    it('renders only the lines in view, up to the last one', async () => {
      const { target } = await open(log(500_000));
      expect(target.querySelectorAll('.dv-line').length).toBeLessThan(60);
      viewer.scroll(parseFloat(target.querySelector<HTMLElement>('.dv-rows')!.style.height) - 600);
      const lines = target.querySelectorAll('.dv-line');
      expect(lines[lines.length - 1]!.textContent).toBe('2026-11-20 INFO request 499999 handled');
      expect(lines[lines.length - 1]!.getAttribute('data-dv-unit')).toBe('499999');
    });

    it('finds a line that is not rendered and renders it when revealed', async () => {
      const { adapter, target } = await open(log(100_000, { 90_000: 'FATAL needle here' }));
      const [match] = (await adapter.search({ text: 'needle', ...QUERY }, new AbortController().signal)).matches;
      expect(match!.locator).toEqual({ unit: 90_000, start: 6, end: 12 });
      expect(target.querySelector('[data-dv-unit="90000"]')).toBeNull();
      await adapter.revealMatch(match!, target);
      expect(target.querySelector('[data-dv-unit="90000"]')?.textContent).toBe('FATAL needle here');
    });
  });

  it('prints at most the print limit of lines and says how many were left out', async () => {
    const adapter = new TextAdapter();
    const model = await adapter.parse(textReader(log(12_000), 'big.log', 'text/plain'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(model, target, true));
    expect(target.querySelectorAll('.dv-line')).toHaveLength(10_000);
    expect(target.textContent).toContain('Printed the first 10,000 of 12,000 lines.');
  });
});
