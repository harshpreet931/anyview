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

    // The quote was stripped, so no event-handler attribute could be injected
    // and the value stays inside the data: URI.
    expect(target.querySelector('[onerror]')).toBeNull();
    const img = target.querySelector('img.dv-ipynb-img');
    expect(img).not.toBeNull();
    const src = img!.getAttribute('src') ?? '';
    expect(src).not.toContain('"');
    expect(src.startsWith('data:image/png;base64,')).toBe(true);
  });
});
