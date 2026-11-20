import { afterEach, describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxAdapter } from './XlsxAdapter';
import type { FileSourceReader, PageRef, RenderContext } from '../../core/types';
import { testViewer, type TestViewer } from '../../core/rows/test-viewer';

function workbookReader(sheets: Record<string, unknown[][]>, origin?: string): FileSourceReader {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(sheet, rows, { origin: origin ?? 'A1' });
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return {
    meta: { name: 'book.xlsx', size: bytes.byteLength, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    arrayBuffer: async () => bytes,
    stream: () => null,
  };
}

function ctx(index: number, target: HTMLElement, page?: PageRef, print = false): RenderContext {
  return {
    page: page ?? { index, width: 1000, height: 800, rotation: 0 },
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
    ...(print ? { print } : {}),
  };
}

const tall = (count: number, special: Record<number, string> = {}) =>
  [['name', 'n'], ...Array.from({ length: count }, (_, i) => [`row ${i}`, special[i] ?? 'x'])];

describe('XlsxAdapter', () => {
  let viewer: TestViewer;
  afterEach(() => viewer?.dispose());

  async function inViewer(sheets: Record<string, unknown[][]>) {
    viewer = testViewer(600);
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(workbookReader(sheets), new AbortController().signal);
    const target = document.createElement('div');
    viewer.container.appendChild(target);
    await adapter.renderPage(ctx(0, target, model.pages[0]));
    return { adapter, model, target };
  }

  it('opens a workbook that contains a blank sheet', async () => {
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(
      workbookReader({ Data: [['name', 'qty'], ['apples', 3]], Empty: [] }),
      new AbortController().signal,
    );
    expect(model.pageCount).toBe(2);

    const first = document.createElement('div');
    await adapter.renderPage(ctx(0, first));
    expect(first.textContent).toContain('apples');

    const blank = document.createElement('div');
    await expect(adapter.renderPage(ctx(1, blank))).resolves.toBeTruthy();
  });

  it('renders every row of a tall sheet, only those in view, with no row cap', async () => {
    const { target } = await inViewer({ Big: tall(6_000) });
    expect(target.querySelectorAll('tbody tr').length).toBeLessThan(60);
    expect(target.querySelector('.dv-sheet-truncated')).toBeNull();
    viewer.scroll(parseFloat(target.querySelector<HTMLElement>('.dv-rows')!.style.height) - 600);
    const last = Array.from(target.querySelectorAll('tbody tr')).at(-1)!;
    expect(last.getAttribute('data-dv-unit')).toBe('6000');
    expect(last.querySelector('th')?.textContent).toBe('6001');
    expect(last.querySelector('[data-dv-cell="0"]')?.textContent).toBe('row 5999');
  }, 30_000);

  it('labels columns by letter and numbers rows as the sheet does', async () => {
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(workbookReader({ S: [['a', 1.5], ['b', 2]] }, 'C3'), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target, model.pages[0]));
    const headers = Array.from(target.querySelectorAll('thead th'), (th) => th.textContent);
    expect(headers.slice(-2)).toEqual(['C', 'D']);
    const row = target.querySelector('[data-dv-unit="2"]')!;
    expect(row.querySelector('th')?.textContent).toBe('3');
    expect(row.querySelector('[data-dv-cell="2"]')?.textContent).toBe('a');
    expect(row.querySelector('[data-dv-cell="3"]')?.textContent).toBe('1.5');
  });

  it('sizes each sheet to its rows before it renders', async () => {
    const { model, target } = await inViewer({ Big: tall(1_000) });
    expect(model.pages[0]!.height).toBe(32 + parseFloat(target.querySelector<HTMLElement>('.dv-rows')!.style.height));
  });

  it('searches every sheet, rendered or not', async () => {
    const sheets: Record<string, unknown[][]> = {};
    for (let s = 0; s < 12; s++) {
      sheets[`Sheet${s + 1}`] = [['a', 'b'], ...Array.from({ length: 5 }, (_, r) => [`s${s}r${r}`, s === 10 && r === 3 ? 'ELEVEN' : 'apple'])];
    }
    const adapter = new XlsxAdapter();
    await adapter.parse(workbookReader(sheets), new AbortController().signal);
    const signal = new AbortController().signal;
    expect((await adapter.search(query('apple'), signal)).matches).toHaveLength(59);
    const [eleven] = (await adapter.search(query('eleven'), signal)).matches;
    expect(eleven).toMatchObject({ pageIndex: 10, text: 'ELEVEN', locator: { unit: 4, cell: 1, start: 0, end: 6 } });

    const target = document.createElement('div');
    await adapter.renderPage(ctx(10, target));
    expect(target.querySelector('[data-dv-unit="4"] [data-dv-cell="1"]')?.textContent).toBe('ELEVEN');
  });

  it('finds a row far down a sheet and renders it when revealed', async () => {
    const { adapter, target } = await inViewer({ Big: tall(6_000, { 5_500: 'FARROW' }) });
    const [match] = (await adapter.search(query('farrow'), new AbortController().signal)).matches;
    expect(match?.locator).toEqual({ unit: 5_501, cell: 1, start: 0, end: 6 });
    expect(target.querySelector('[data-dv-unit="5501"]')).toBeNull();
    await adapter.revealMatch(match!, target);
    expect(target.querySelector('[data-dv-unit="5501"] [data-dv-cell="1"]')?.textContent).toBe('FARROW');
  }, 30_000);

  it('prints at most the print limit of rows and says how many were left out', async () => {
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(workbookReader({ Big: tall(10_500) }), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target, model.pages[0], true));
    expect(target.querySelectorAll('tbody tr')).toHaveLength(10_000);
    expect(target.textContent).toContain('Printed the first 10,000 of 10,501 rows.');
  }, 30_000);
});

function query(text: string) {
  return { text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false };
}
