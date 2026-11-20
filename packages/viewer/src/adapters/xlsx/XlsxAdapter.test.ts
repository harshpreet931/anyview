import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxAdapter } from './XlsxAdapter';
import type { FileSourceReader, PageRef, RenderContext } from '../../core/types';
import { locateMatch, matchRanges } from '../../core/search-units';
import { testViewer, type TestViewer } from '../../core/rows/test-viewer';

function workbookReader(sheets: Record<string, unknown[][]>, origin?: string, merges: Record<string, string[]> = {}): FileSourceReader {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(sheet, rows, { origin: origin ?? 'A1' });
    if (merges[name]) sheet['!merges'] = merges[name].map((ref) => XLSX.utils.decode_range(ref));
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

  async function inViewer(sheets: Record<string, unknown[][]>, merges?: Record<string, string[]>) {
    viewer = testViewer(600);
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(workbookReader(sheets, undefined, merges), new AbortController().signal);
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

  it('draws a merged title as one cell across the columns it spans', async () => {
    const rows = [['Quarterly report', '', '', 'Q4'], ['a', 'b', 'c', 'd'], [1, 2, 3, 4]];
    const { adapter, target } = await inViewer({ S: rows }, { S: ['A1:C1'] });
    const widths = Array.from(target.querySelectorAll<HTMLElement>('.dv-rows-layer col'), (col) => parseFloat(col.style.width));
    expect(new Set(widths.slice(1)).size).toBe(1);

    const merge = target.querySelector<HTMLElement>('.dv-grid-merge')!;
    expect(merge.textContent).toBe('Quarterly report');
    expect(parseFloat(merge.style.width)).toBe(widths[1]! + widths[2]! + widths[3]!);
    expect(parseFloat(merge.style.height)).toBe(28);
    const first = target.querySelector('tbody tr[data-dv-unit="0"]')!;
    expect(first.querySelector('td')!.colSpan).toBe(3);
    expect(Array.from(first.querySelectorAll('[data-dv-cell]'), (td) => td.textContent)).toEqual(['Q4']);

    const signal = new AbortController().signal;
    const found = [...(await adapter.search(query('quarterly'), signal)).matches, ...(await adapter.search(query('q4'), signal)).matches];
    const ranges = matchRanges(target, found, 0);
    expect(ranges.get(0)?.toString()).toBe('Quarterly');
    expect(ranges.get(0)?.startContainer.parentElement?.closest('.dv-grid-merge')).toBe(merge);
    expect(ranges.get(1)?.toString()).toBe('Q4');
  });

  it('covers every row of a tall merge, also while its first row is scrolled out of view', async () => {
    const rows: unknown[][] = [['id', 'v', 'c', 'd'], ...Array.from({ length: 3_000 }, (_, i) => [i, `v${i}`, '', ''])];
    rows[10]![2] = 'BLOCK';
    rows[11]![3] = 'HIDDEN';
    const { adapter, target } = await inViewer({ S: rows }, { S: ['C11:D2000'] });
    const signal = new AbortController().signal;
    expect((await adapter.search(query('hidden'), signal)).matches).toHaveLength(0);

    viewer.scroll(1_000 * 28);
    const shown = Array.from(target.querySelectorAll<HTMLElement>('tbody tr'));
    const from = Number(shown[0]!.dataset.dvUnit);
    expect(from).toBeGreaterThan(100);
    for (const tr of shown) {
      expect(tr.querySelector('[data-dv-cell="2"], [data-dv-cell="3"]')).toBeNull();
      expect(tr.querySelectorAll('td')[2]!.colSpan).toBe(2);
    }
    const merge = target.querySelector<HTMLElement>('.dv-grid-merge')!;
    expect(merge.dataset.dvUnit).toBe('10');
    expect(merge.style.top).toBe('0px');
    expect(parseFloat(merge.style.height)).toBe(shown.length * 28);
    const text = merge.querySelector<HTMLElement>('[data-dv-cell="2"]')!;
    expect(text.textContent).toBe('BLOCK');
    expect(from * 28 + parseFloat(text.style.top) + 14).toBe(((10 + 2_000) / 2) * 28);

    const [match] = (await adapter.search(query('block'), signal)).matches;
    expect(matchRanges(target, [match!], 0).get(0)?.toString()).toBe('BLOCK');
    await adapter.revealMatch(match!, target);
    expect(target.querySelector('tbody tr[data-dv-unit="10"]')).not.toBeNull();
    expect(matchRanges(target, [match!], 0).get(0)?.toString()).toBe('BLOCK');
    expect(String(locateMatch(target, match!))).toBe('BLOCK');

    viewer.scroll(2_500 * 28);
    expect(target.querySelector('.dv-grid-merge')).toBeNull();
    expect(target.querySelector('tbody tr [data-dv-cell="2"]')).not.toBeNull();
  });

  it('prints merged cells where they belong', async () => {
    const adapter = new XlsxAdapter();
    const rows = [['a', 'b'], ['one', ''], ['', ''], ['two', 'x']];
    const model = await adapter.parse(workbookReader({ S: rows }, undefined, { S: ['A2:B3'] }), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target, model.pages[0], true));
    const merge = target.querySelector<HTMLElement>('.dv-grid-merge')!;
    expect(merge.textContent).toBe('one');
    expect(merge.style.top).toBe('28px');
    expect(parseFloat(merge.style.height)).toBe(56);
  });

  it('prints at most the print limit of rows and says how many were left out', async () => {
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(workbookReader({ Big: tall(10_500) }), new AbortController().signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target, model.pages[0], true));
    expect(target.querySelectorAll('tbody tr')).toHaveLength(10_000);
    expect(target.textContent).toContain('Printed the first 10,000 of 10,501 rows.');
  }, 30_000);
});

describe('XlsxAdapter with workers', () => {
  type Mode = 'run' | 'fail' | 'hang';
  let mode: Mode = 'run';
  const workers: FakeWorker[] = [];

  class FakeWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    terminated = false;
    received: unknown[] = [];

    constructor(readonly url: URL, readonly options?: WorkerOptions) {
      workers.push(this);
    }

    postMessage(data: ArrayBuffer) {
      this.received.push(data);
      setTimeout(() => void this.answer(data));
    }

    terminate() {
      this.terminated = true;
    }

    private async answer(data: ArrayBuffer) {
      if (mode === 'fail') this.onerror?.(new Event('error'));
      if (mode !== 'run') return;
      vi.stubGlobal('postMessage', (message: unknown) => {
        if (!this.terminated) this.onmessage?.(new MessageEvent('message', { data: message }));
      });
      await import('./xlsx.worker');
      self.onmessage!(new MessageEvent('message', { data }));
    }
  }

  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal('Worker', FakeWorker);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function open(signal = new AbortController().signal) {
    const adapter = new XlsxAdapter();
    const model = await adapter.parse(workbookReader({ Data: [['name', 'qty'], ['apples', 3]] }), signal);
    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target, model.pages[0]));
    return target;
  }

  it('reads the workbook in a worker, then stops it', async () => {
    mode = 'run';
    const target = await open();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.url.pathname).toMatch(/xlsx\.worker\.ts$/);
    expect(workers[0]!.options).toEqual({ type: 'module' });
    expect(workers[0]!.received).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(true);
    expect(target.querySelector('[data-dv-unit="1"] [data-dv-cell="0"]')?.textContent).toBe('apples');
  });

  it('reads the workbook itself when the worker cannot start', async () => {
    mode = 'fail';
    const target = await open();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(true);
    expect(target.querySelector('[data-dv-unit="1"] [data-dv-cell="1"]')?.textContent).toBe('3');
  });

  it('stops the worker when opening is cancelled', async () => {
    mode = 'hang';
    const controller = new AbortController();
    const opening = open(controller.signal);
    await vi.waitFor(() => expect(workers[0]?.received).toHaveLength(1));
    controller.abort();
    await expect(opening).rejects.toThrow('Parse cancelled');
    expect(workers[0]!.terminated).toBe(true);
  });
});

function query(text: string) {
  return { text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false };
}
