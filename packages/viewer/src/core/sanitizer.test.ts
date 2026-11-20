import { describe, it, expect } from 'vitest';
import { hasNetworkCss } from './sanitizer';

describe('hasNetworkCss', () => {
  it.each([
    'background:url(https://beacon.invalid/a.png)',
    'background:url("https://beacon.invalid/quoted-paren)")',
    "background:url('https://beacon.invalid/x')",
    'background:\\75 rl(https://beacon.invalid/escaped)',
    'background:\\55RL(https://beacon.invalid/escaped-upper)',
    'background-image:image-set("https://beacon.invalid/set.png" 1x)',
    'background-image:-webkit-image-set(url(https://beacon.invalid/w.png) 1x)',
    'background:URL( //beacon.invalid/protocol-relative )',
    '@import "https://beacon.invalid/i.css"',
    'width:expression(alert(1))',
    'background:url(data:image/png;base64,AAAA), url(https://beacon.invalid/second)',
  ])('flags %s', (style) => {
    expect(hasNetworkCss(style)).toBe(true);
  });

  it.each([
    'color:red;font-weight:bold',
    'background:url(data:image/png;base64,iVBORw0KGgo=)',
    'background:url("data:image/svg+xml;utf8,<svg></svg>")',
    'clip-path:url(#shape)',
    'content:"url(not-a-function)"',
    '',
  ])('allows %s', (style) => {
    expect(hasNetworkCss(style)).toBe(false);
  });
});

describe('DOM clobbering', () => {
  it('namespaces document ids so they cannot shadow globals, and keeps in-page links working', async () => {
    const { loadSanitizer, DOCUMENT_HTML_CONFIG } = await import('./sanitizer');
    const DOMPurify = await loadSanitizer();
    const host = document.createElement('div');
    host.innerHTML = DOMPurify.sanitize(
      '<img id="anyviewConfig" alt=""><h2 id="intro">Intro</h2><a href="#intro">jump</a><a href="https://x.test/#a">out</a>',
      DOCUMENT_HTML_CONFIG,
    );
    document.body.appendChild(host);
    try {
      expect((window as unknown as Record<string, unknown>).anyviewConfig).toBeUndefined();
      const heading = host.querySelector('h2')!;
      const [inPage, external] = Array.from(host.querySelectorAll('a'));
      expect(heading.id).not.toBe('intro');
      expect(inPage!.getAttribute('href')).toBe(`#${heading.id}`);
      expect(external!.getAttribute('href')).toBe('https://x.test/#a');
    } finally {
      host.remove();
    }
  });
});

describe('sanitizeInPieces', () => {
  const blocks = (n: number) =>
    Array.from({ length: n }, (_, i) => `<p id="p${i}" onclick="x()">para ${i} <img src="https://beacon.invalid/${i}.png" onerror="y()"> ${'w'.repeat(300)}</p><script>z()</script>`).join('');

  async function both(dirty: string) {
    const { loadSanitizer, sanitizeInPieces, DOCUMENT_HTML_CONFIG } = await import('./sanitizer');
    const { detachedReflow } = await import('./reflow-page');
    const DOMPurify = await loadSanitizer();
    const content = await sanitizeInPieces(dirty, DOCUMENT_HTML_CONFIG, new AbortController().signal);
    const root = await detachedReflow(content, new AbortController().signal);
    root.querySelectorAll('.dv-reflow-piece').forEach((piece) => piece.replaceWith(...piece.childNodes));
    return { pieces: content.pieces.length, inPieces: root.innerHTML, whole: DOMPurify.sanitize(dirty, DOCUMENT_HTML_CONFIG) };
  }

  it('sanitizes a long document in pieces, with the same result as in one go', async () => {
    const { pieces, inPieces, whole } = await both(`<!doctype html><html><head><title>t</title><style>p{}</style></head><body>${blocks(400)}</body></html>`);
    expect(pieces).toBeGreaterThan(1);
    expect(inPieces).toBe(whole);
    expect(inPieces).not.toMatch(/onclick|onerror|script|beacon/);
  });

  it('splits inside lone wrappers and keeps them, sanitized, around the pieces', async () => {
    const { pieces, inPieces, whole } = await both(`<div class="page" onmouseover="x()"><article>${blocks(400)}</article></div>`);
    expect(pieces).toBeGreaterThan(1);
    expect(inPieces).toBe(whole);
  });

  it('starts every piece after the first with a block that has no top margin', async () => {
    const { sanitizeInPieces, DOCUMENT_HTML_CONFIG } = await import('./sanitizer');
    const { detachedReflow } = await import('./reflow-page');
    const dirty = Array.from({ length: 400 }, (_, i) => `<p>${i}</p><h2>${'w'.repeat(300)} ${i}</h2><hr><ul><li>x</li></ul><h3>${'v'.repeat(100)}</h3>`).join('');
    const root = await detachedReflow(await sanitizeInPieces(dirty, DOCUMENT_HTML_CONFIG, new AbortController().signal), new AbortController().signal);
    const pieces = Array.from(root.querySelectorAll('.dv-reflow-piece'));
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces.slice(1)) expect(['P', 'UL']).toContain(piece.firstElementChild?.tagName);
  });

  it('keeps loose text next to a wrapper', async () => {
    const { inPieces, whole } = await both(`intro<div>${blocks(400)}</div>outro`);
    expect(inPieces).toBe(whole);
  });
});
