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
  it.each([
    ['lowercase .tsv as tab-separated', TSV, 'data.tsv', 'text/tab-separated-values', 3],
    ['uppercase .TSV as tab-separated', TSV, 'DATA.TSV', 'text/tab-separated-values', 3],
    ['.csv as comma-separated', 'name,age,city\nAda,36,London\n', 'data.csv', 'text/csv', 3],
    ['semicolon-separated .csv', 'name;age;city\nAda;36;London\n', 'data.csv', 'text/csv', 3],
    ['single-column .csv as one column', 'name\nAda\nGrace\n', 'data.csv', 'text/csv', 1],
  ])('parses %s', async (_label, text, name, mimeType, columns) => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader(text, name, mimeType), new AbortController().signal);
    expect(await columnCount(adapter)).toBe(columns);
  });
});

function renderCtx(target: HTMLElement, print = false): RenderContext {
  return {
    page: { index: 0, width: 1000, height: 400, rotation: 0 },
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
    ...(print ? { print } : {}),
  };
}

const QUERY = { caseSensitive: false, wholeWord: false, regex: false, diacritics: false };

function bigCsv(rows: number, special: Record<number, string> = {}): string {
  const lines = ['id,name,note'];
  for (let i = 1; i <= rows; i++) lines.push(`${i},name${i},${special[i] ?? 'regular'}`);
  return lines.join('\n');
}

describe('CsvAdapter search', () => {
  it('finds rows that are not rendered and says where each match is', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader(bigCsv(5000, { 4500: 'NEEDLE' }), 'big.csv', 'text/csv'), new AbortController().signal);
    const result = await adapter.search({ text: 'needle', ...QUERY }, new AbortController().signal);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.locator).toEqual({ unit: 4500, cell: 2, start: 0, end: 6 });
  });

  it('keeps cells apart', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader('a,b\nname200,1400\n', 'cells.csv', 'text/csv'), new AbortController().signal);
    expect((await adapter.search({ text: 'name2001', ...QUERY }, new AbortController().signal)).matches).toHaveLength(0);
  });

  it('marks rendered rows and cells with the units search reports', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader('h1,h2\nx,y\n', 'small.csv', 'text/csv'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(renderCtx(target));
    expect(target.querySelector('[data-dv-unit="0"] [data-dv-cell="1"]')?.textContent).toBe('h2');
    expect(target.querySelector('[data-dv-unit="1"] [data-dv-cell="0"]')?.textContent).toBe('x');
  });

  it('renders rows past the cap when a match there is revealed', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader(bigCsv(5000, { 4500: 'NEEDLE' }), 'big.csv', 'text/csv'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(renderCtx(target));
    expect(target.querySelector('[data-dv-unit="4500"]')).toBeNull();
    const [match] = (await adapter.search({ text: 'needle', ...QUERY }, new AbortController().signal)).matches;
    await adapter.revealMatch(match!, target);
    expect(target.querySelector('[data-dv-unit="4500"] [data-dv-cell="2"]')?.textContent).toBe('NEEDLE');
    expect(target.querySelector('.dv-csv-more')?.textContent).toMatch(/500 remaining/);
  });

  it('prints every row without the show-more button', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader(bigCsv(5000), 'big.csv', 'text/csv'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(renderCtx(target, true));
    expect(target.querySelectorAll('tbody tr')).toHaveLength(5000);
    expect(target.querySelector('button')).toBeNull();
  });

  it('prints at most the print limit and says how many rows were left out', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader(bigCsv(12_000), 'big.csv', 'text/csv'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(renderCtx(target, true));
    expect(target.querySelectorAll('tbody tr')).toHaveLength(10_000);
    expect(target.textContent).toContain('Printed the first 10,000 of 12,000 rows.');
  });
});
