import { afterEach, describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workerSources } from '../test-worker-sources';

describe('xlsx worker bundle', () => {
  it('has no dynamic imports, so bundlers that emit classic workers can build it', () => {
    const entry = resolve(dirname(fileURLToPath(import.meta.url)), 'xlsx.worker.ts');
    const sources = workerSources(entry);
    expect(sources.size).toBeGreaterThan(1);
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/\bimport\s*\(/);
    }
  });
});

function workbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name', 'qty'], ['apples', 3], [], ['pears']]), 'Fruit');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Empty');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('xlsx worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function ask(data: ArrayBuffer) {
    const posted: Array<[unknown, StructuredSerializeOptions | undefined]> = [];
    vi.stubGlobal('postMessage', (message: unknown, options?: StructuredSerializeOptions) => posted.push([message, options]));
    await import('./xlsx.worker');
    await self.onmessage!(new MessageEvent('message', { data }));
    expect(posted).toHaveLength(1);
    return posted[0]!;
  }

  it('answers with each sheet’s text in one string and moves its offsets instead of copying them', async () => {
    const [reply, options] = await ask(workbook());
    const { sheets } = reply as { sheets: Array<{ name: string; text: string; rows: Uint32Array; cells: Uint32Array }> };
    expect(sheets.map((s) => s.name)).toEqual(['Fruit', 'Empty']);
    const [fruit] = sheets;
    expect(fruit!.text).toBe('nameqtyapples3pears');
    expect(Array.from(fruit!.rows)).toEqual([0, 2, 4, 4, 5]);
    expect(Array.from(fruit!.cells)).toEqual([0, 4, 7, 13, 14, 19]);
    expect(options?.transfer).toEqual(sheets.flatMap((s) => [s.rows.buffer, s.cells.buffer]));
  });

  it('answers a file it cannot read with the reason', async () => {
    const [reply] = await ask(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]).buffer);
    expect(reply).toEqual({ error: expect.any(String) });
  });
});
