import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxAdapter } from './XlsxAdapter';
import type { FileSourceReader, RenderContext } from '../../core/types';

function workbookReader(sheets: Record<string, unknown[][]>): FileSourceReader {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return {
    meta: { name: 'book.xlsx', size: bytes.byteLength, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    arrayBuffer: async () => bytes,
    stream: () => null,
  };
}

function ctx(index: number, target: HTMLElement): RenderContext {
  return {
    page: { index, width: 1000, height: 800, rotation: 0 },
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
  };
}

describe('XlsxAdapter', () => {
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

  it('renders a bounded number of rows for very tall sheets and says so', async () => {
    const rows = Array.from({ length: 6_000 }, (_, i) => [`row ${i}`, i]);
    const adapter = new XlsxAdapter();
    await adapter.parse(workbookReader({ Big: [['name', 'n'], ...rows] }), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target));
    expect(target.querySelectorAll('tr').length).toBeLessThanOrEqual(5001);
    expect(target.textContent).toContain('row 0');
    expect(target.querySelector('.dv-sheet-truncated')?.textContent).toMatch(/6,001/);
  }, 30_000);

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

  it('finds rows past the render cap and renders them when revealed', async () => {
    const rows = Array.from({ length: 6_000 }, (_, i) => [`row ${i}`, i === 5_500 ? 'FARROW' : 'x']);
    const adapter = new XlsxAdapter();
    await adapter.parse(workbookReader({ Big: [['name', 'n'], ...rows] }), new AbortController().signal);
    const [match] = (await adapter.search(query('farrow'), new AbortController().signal)).matches;
    expect(match?.locator).toEqual({ unit: 5_501, cell: 1, start: 0, end: 6 });

    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target));
    expect(target.querySelector('[data-dv-unit="5501"]')).toBeNull();
    await adapter.revealMatch(match!, target);
    expect(target.querySelector('[data-dv-unit="5501"] [data-dv-cell="1"]')?.textContent).toBe('FARROW');
    expect(target.querySelector('.dv-sheet-truncated')?.textContent).not.toMatch(/first 5,000/);
  }, 30_000);
});

function query(text: string) {
  return { text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false };
}

