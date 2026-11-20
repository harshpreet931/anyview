import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Adapter, RenderContext } from './types';
import { printInFrame } from './print';
import { makeDoc, manifest } from './store/test-fixtures';

afterEach(() => vi.restoreAllMocks());

describe('printInFrame', () => {
  it('asks each page for a print render and never prints interactive controls', async () => {
    const asked: Array<boolean | undefined> = [];
    const adapter: Adapter = {
      manifest: manifest(),
      parse: async () => makeDoc(2),
      renderPage: async (ctx: RenderContext) => {
        asked.push(ctx.print);
        (ctx.target as HTMLElement).innerHTML = '<p>row</p><button type="button">Show 2,000 more rows</button>';
        return { width: 0, height: 0 };
      },
    };
    let frame: HTMLIFrameElement | null = null;
    const append = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
      append(node);
      if (node instanceof HTMLIFrameElement) {
        frame = node;
        node.contentWindow!.print = () => {};
      }
      return node;
    });

    await printInFrame(adapter, { ...makeDoc(2), format: 'csv' });

    expect(asked).toEqual([true, true]);
    const printed = frame!.contentDocument!.body;
    expect(printed.querySelectorAll('p')).toHaveLength(2);
    expect(printed.textContent).not.toContain('Show 2,000 more rows');
  });
});
