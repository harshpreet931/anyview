import { describe, it, expect } from 'vitest';
import { markSanitized, type SafeHtml } from './safe-html';
import { unitText } from './search-units';
import { detachedReflow, reflowBlockTexts, renderReflowPage, type ReflowContent } from './reflow-page';
import type { RenderContext } from './types';

const html = (s: string) => markSanitized(s);

function context(signal = new AbortController().signal): RenderContext {
  return {
    page: { index: 0, width: 800, height: 400, rotation: 0 },
    target: document.createElement('div'),
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal,
  };
}

const paragraphs = (from: number, count: number): SafeHtml =>
  html(Array.from({ length: count }, (_, i) => `<p>para ${from + i} ${'x'.repeat(200)}</p>`).join(''));

describe('renderReflowPage', () => {
  it('places a single piece in the innermost element of the shell, and marks its blocks', async () => {
    const ctx = context();
    const content: ReflowContent = { shell: html('<div class="outer"><main></main></div>'), pieces: [html('<p>a</p><p>b</p>')] };
    await renderReflowPage(ctx, content, { className: 'dv-x' });
    const main = ctx.target.querySelector('.dv-x > .outer > main')!;
    expect(Array.from(main.children, (p) => [p.textContent, p.getAttribute('data-dv-unit')])).toEqual([
      ['a', '0'],
      ['b', '1'],
    ]);
  });

  it('wraps each of several pieces, and numbers the blocks across them', async () => {
    const ctx = context();
    const content: ReflowContent = { shell: html('<main></main>'), pieces: [html('<p>a</p><p>b</p>'), html('<p>c</p>')] };
    await renderReflowPage(ctx, content, { className: 'dv-x' });
    const pieces = ctx.target.querySelectorAll('.dv-x > main > .dv-reflow-piece');
    expect(Array.from(pieces, (piece) => Array.from(piece.children, (p) => `${p.textContent}${p.getAttribute('data-dv-unit')}`))).toEqual([
      ['a0', 'b1'],
      ['c2'],
    ]);
  });

  it('adds a long page over several frames, drawing each piece in full for a frame before it may be skipped', async () => {
    const ctx = context();
    const pieces = Array.from({ length: 40 }, (_, i) => paragraphs(i * 100, 100));
    let frame = 0;
    let ticking = true;
    const tick = () => {
      frame++;
      if (ticking) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const added = new Map<Node, number>();
    const drawn = new Map<Node, number>();
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => n instanceof Element && n.classList.contains('dv-reflow-piece-new') && added.set(n, frame));
        if (r.type === 'attributes' && !(r.target as Element).classList.contains('dv-reflow-piece-new')) drawn.set(r.target, frame);
      }
    });
    observer.observe(ctx.target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const done = renderReflowPage(ctx, { shell: html(''), pieces }, { className: 'dv-x' });
    expect(ctx.target.querySelectorAll('p')).toHaveLength(0);
    await done;
    await new Promise((resolve) => setTimeout(resolve));
    observer.disconnect();
    ticking = false;
    expect(ctx.target.querySelectorAll('p')).toHaveLength(4000);
    expect(added.size).toBe(40);
    expect(new Set(added.values()).size).toBeGreaterThan(1);
    for (const [piece, at] of added) expect(drawn.get(piece)).toBeGreaterThan(at);
  });

  it('adds everything at once for print', async () => {
    const ctx = { ...context(), print: true };
    const pieces = Array.from({ length: 40 }, (_, i) => paragraphs(i * 100, 100));
    const done = renderReflowPage(ctx, { shell: html(''), pieces }, { className: 'dv-x' });
    expect(ctx.target.querySelectorAll('p')).toHaveLength(4000);
    await done;
  });

  it('stops adding pieces once the render is cancelled', async () => {
    const controller = new AbortController();
    const ctx = context(controller.signal);
    const pieces = Array.from({ length: 40 }, (_, i) => paragraphs(i * 100, 100));
    const done = renderReflowPage(ctx, { shell: html(''), pieces }, { className: 'dv-x' });
    controller.abort();
    await expect(done).rejects.toThrow();
    expect(ctx.target.querySelectorAll('p').length).toBeLessThan(4000);
  });
});

describe('reflowBlockTexts', () => {
  it('gives the text of the blocks the rendered page marks', async () => {
    const content = {
      shell: html('<div class="dv-ipynb"></div>'),
      pieces: [html('<h1>Title</h1><p>one <b>two</b></p>'), html('<ul><li>a</li><li>b</li></ul>'), html('<p>end</p>')],
    };
    const ctx = context();
    await renderReflowPage(ctx, content, { className: 'dv-x' });
    const marked = Array.from(ctx.target.querySelectorAll('[data-dv-unit]'), (el) => unitText(el).text);
    expect(marked).toEqual(['Title', 'one two', 'a', 'b', 'end']);
    expect(await reflowBlockTexts(content, new AbortController().signal)).toEqual(marked);
  });

  it('treats a page of one block like the rendered page does', async () => {
    const pieces = [html('<div><p>only</p><p>child</p></div>')];
    expect(await reflowBlockTexts({ shell: html(''), pieces }, new AbortController().signal)).toEqual(['only', 'child']);
  });
});

describe('detachedReflow', () => {
  it('builds the page outside the live document', async () => {
    const root = await detachedReflow({ shell: html('<div></div>'), pieces: [html('<p>a</p>'), html('<p>b</p>')] }, new AbortController().signal);
    expect(root.ownerDocument).not.toBe(document);
    expect(root.innerHTML).toBe('<div><div class="dv-reflow-piece"><p>a</p></div><div class="dv-reflow-piece"><p>b</p></div></div>');
  });
});
