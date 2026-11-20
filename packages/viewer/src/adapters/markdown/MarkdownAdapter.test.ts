import { describe, it, expect } from 'vitest';
import { MarkdownAdapter } from './MarkdownAdapter';
import { textReader } from '../test-reader';
import { loadMarkdownRenderer } from '../../core/markdown-render';
import type { PageDestination, RenderContext } from '../../core/types';

const signal = () => new AbortController().signal;

function context(target: HTMLElement): RenderContext {
  return { page: { index: 0, width: 800, height: 400, rotation: 0 }, target, scale: 1, rotation: 0, devicePixelRatio: 1, signal: signal() };
}

describe('MarkdownAdapter outline', () => {
  it('lists the headings the page renders, by their text', async () => {
    const markdown = '# **Bold** title\n\n```\n# not a heading\n```\n\nSetext\n======\n\n> ## Quoted\n';
    const model = await new MarkdownAdapter().parse(textReader(markdown, 'doc.md', 'text/markdown'), signal());
    expect(model.outline?.map((node) => node.title)).toEqual(['Bold title', 'Setext', 'Quoted']);
  });

  it('lands each repeated heading on its own rendered heading', async () => {
    const markdown = '# Notes\n\ntext\n\n# Notes\n\nmore\n\n# Notes\n';
    const adapter = new MarkdownAdapter();
    const model = await adapter.parse(textReader(markdown, 'doc.md', 'text/markdown'), signal());
    const target = document.body.appendChild(document.createElement('div'));
    await adapter.renderPage(context(target));
    target.querySelectorAll('h1').forEach((h, i) => {
      h.getBoundingClientRect = () => ({ top: 300 * i + 10 }) as DOMRect;
    });
    expect(model.outline?.map((node) => (node.dest as PageDestination).scrollOffset)).toEqual([10, 310, 610]);
    target.remove();
  });
});

describe('MarkdownAdapter rendering', () => {
  it('renders a long document a piece at a time into the markup of the whole', async () => {
    const markdown = Array.from({ length: 400 }, (_, i) => `## Part ${i}\n\nSome *text* in part ${i}.\n\n- a\n- b\n`).join('\n');
    const adapter = new MarkdownAdapter();
    await adapter.parse(textReader(markdown, 'doc.md', 'text/markdown'), signal());
    const target = document.createElement('div');
    await adapter.renderPage(context(target));
    const page = target.firstElementChild!;
    expect(page.querySelectorAll('.dv-reflow-piece').length).toBeGreaterThan(1);
    page.querySelectorAll('.dv-reflow-piece').forEach((piece) => piece.replaceWith(...piece.childNodes));
    page.querySelectorAll('[data-dv-unit]').forEach((el) => el.removeAttribute('data-dv-unit'));
    const whole = document.createElement('div');
    whole.innerHTML = (await loadMarkdownRenderer())(markdown);
    expect(page.innerHTML.replace(/>\n</g, '><')).toBe(whole.innerHTML.replace(/>\n</g, '><'));
  });
});
