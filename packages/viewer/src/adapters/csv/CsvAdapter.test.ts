import { describe, it, expect } from 'vitest';
import { CsvAdapter } from './CsvAdapter';
import type { FileSourceReader, RenderContext } from '../../core/types';

function reader(text: string, name: string, mimeType: string): FileSourceReader {
  const buffer = new TextEncoder().encode(text).buffer;
  return {
    meta: { name, size: buffer.byteLength, mimeType },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}

async function columnCount(adapter: CsvAdapter): Promise<number> {
  const target = document.createElement('div');
  const ctx: RenderContext = {
    page: { index: 0, width: 1000, height: 400, rotation: 0 },
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
  };
  await adapter.renderPage(ctx);
  return target.querySelectorAll('th').length;
}

const TSV = 'name\tage\tcity\nAda\t36\tLondon\n';

describe('CsvAdapter delimiter detection', () => {
  it('parses lowercase .tsv as tab-separated', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(
      reader(TSV, 'data.tsv', 'text/tab-separated-values'),
      new AbortController().signal,
    );
    expect(await columnCount(adapter)).toBe(3);
  });

  it('parses uppercase .TSV as tab-separated', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(
      reader(TSV, 'DATA.TSV', 'text/tab-separated-values'),
      new AbortController().signal,
    );
    expect(await columnCount(adapter)).toBe(3);
  });

  it('parses .csv as comma-separated', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(
      reader('name,age,city\nAda,36,London\n', 'data.csv', 'text/csv'),
      new AbortController().signal,
    );
    expect(await columnCount(adapter)).toBe(3);
  });
});
