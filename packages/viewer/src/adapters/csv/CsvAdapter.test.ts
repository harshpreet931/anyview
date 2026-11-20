import { afterEach, describe, it, expect } from 'vitest';
import { CsvAdapter } from './CsvAdapter';
import type { FileSourceReader, RenderContext } from '../../core/types';
import { testViewer, type TestViewer } from '../../core/rows/test-viewer';

function reader(text: string, name: string, mimeType: string): FileSourceReader {
  const buffer = new TextEncoder().encode(text).buffer;
  return {
    meta: { name, size: buffer.byteLength, mimeType },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}

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

async function columnCount(adapter: CsvAdapter): Promise<number> {
  const target = document.createElement('div');
  await adapter.renderPage(renderCtx(target));
  return target.querySelectorAll('thead th[data-dv-cell]').length;
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

  it('prints every row without controls', async () => {
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

describe('CsvAdapter rows', () => {
  let viewer: TestViewer;
  afterEach(() => viewer?.dispose());

  async function inViewer(rows: number, special: Record<number, string> = {}) {
    viewer = testViewer(600);
    const adapter = new CsvAdapter();
    const model = await adapter.parse(reader(bigCsv(rows, special), 'big.csv', 'text/csv'), new AbortController().signal);
    const target = document.createElement('div');
    viewer.container.appendChild(target);
    await adapter.renderPage({ ...renderCtx(target), page: model.pages[0]! });
    return { adapter, model, target };
  }

  const bodyRows = (target: HTMLElement) => target.querySelectorAll('tbody tr');
  const label = (row: Element | null | undefined) => row?.querySelector('th')?.textContent;

  it('renders only the rows in view, numbered from 1, with no row cap or "show more"', async () => {
    const { target } = await inViewer(100_000);
    expect(bodyRows(target).length).toBeLessThan(60);
    expect(label(bodyRows(target)[0])).toBe('1');
    expect(target.querySelector('thead [data-dv-cell="1"]')?.textContent).toBe('name');
    expect(target.querySelector('button')).toBeNull();

    viewer.scroll(parseFloat(target.querySelector<HTMLElement>('.dv-rows')!.style.height) - 600);
    const rows = bodyRows(target);
    expect(label(rows[rows.length - 1])).toBe('100000');
    expect(rows[rows.length - 1]!.getAttribute('data-dv-unit')).toBe('100000');
    expect(rows[rows.length - 1]!.querySelector('[data-dv-cell="1"]')?.textContent).toBe('name100000');
  });

  it('sizes the page to its header and rows before anything is rendered', async () => {
    const { model, target } = await inViewer(1_000);
    const spacer = target.querySelector<HTMLElement>('.dv-rows')!;
    expect(model.pages[0]!.height).toBe(32 + parseFloat(spacer.style.height));
  });

  it('scrolls a match far down the table into view when it is revealed', async () => {
    const { adapter, target } = await inViewer(50_000, { 45_000: 'NEEDLE' });
    expect(target.querySelector('[data-dv-unit="45000"]')).toBeNull();
    const [match] = (await adapter.search({ text: 'needle', ...QUERY }, new AbortController().signal)).matches;
    await adapter.revealMatch(match!, target);
    expect(target.querySelector('[data-dv-unit="45000"] [data-dv-cell="2"]')?.textContent).toBe('NEEDLE');
  });

  it('previews only the first screen of rows outside the viewer', async () => {
    const adapter = new CsvAdapter();
    await adapter.parse(reader(bigCsv(5000), 'big.csv', 'text/csv'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(renderCtx(target));
    expect(bodyRows(target).length).toBeLessThan(60);
    expect(target.querySelector('button')).toBeNull();
  });

  it('keeps quoted fields with line breaks whole where the file is cut into slices', async () => {
    const lines = ['id,text'];
    for (let i = 1; i <= 60_000; i++) lines.push(i % 7 === 0 ? `${i},"two\nlines, ""quoted"""` : `${i},plain text for row ${i}`);
    const adapter = new CsvAdapter();
    await adapter.parse(reader(lines.join('\n'), 'multi.csv', 'text/csv'), new AbortController().signal);
    const quoted = await adapter.search({ text: 'two\nlines, "quoted"', ...QUERY }, new AbortController().signal);
    expect(quoted.matches).toHaveLength(Math.floor(60_000 / 7));
    const last = await adapter.search({ text: 'plain text for row 59999', ...QUERY }, new AbortController().signal);
    expect(last.matches.map((m) => m.locator)).toEqual([{ unit: 59_999, cell: 1, start: 0, end: 24 }]);
  });

  it('parses a big file in slices, so the page stays responsive', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0);
    const adapter = new CsvAdapter();
    await adapter.parse(reader(bigCsv(200_000), 'big.csv', 'text/csv'), new AbortController().signal);
    clearInterval(timer);
    expect(ticks).toBeGreaterThan(2);
  });
});
