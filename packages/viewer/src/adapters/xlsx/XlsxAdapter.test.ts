import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxAdapter } from './XlsxAdapter';
import type { FileSourceReader, RenderContext } from '../../core/types';

function workbookReader(): FileSourceReader {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name', 'qty'], ['apples', 3]]), 'Data');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Empty');
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
    const model = await adapter.parse(workbookReader(), new AbortController().signal);
    expect(model.pageCount).toBe(2);

    const first = document.createElement('div');
    await adapter.renderPage(ctx(0, first));
    expect(first.textContent).toContain('apples');

    const blank = document.createElement('div');
    await expect(adapter.renderPage(ctx(1, blank))).resolves.toBeTruthy();
  });
});
