import { describe, it, expect, vi, afterEach } from 'vitest';
import { createViewerStore } from './index';
import type { Adapter, DocumentModel, RenderResult } from '../types';
import { bufferSource, makeDoc, manifest } from './test-fixtures';

class ThrowingExportAdapter implements Adapter {
  readonly manifest = manifest();
  async parse(): Promise<DocumentModel> {
    return makeDoc();
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
  exportDocument(): Promise<Blob> {
    throw new Error('export is not supported');
  }
}

afterEach(() => vi.restoreAllMocks());

describe('downloadDocument', () => {
  it('falls back to the original bytes when the adapter export throws synchronously', async () => {
    const store = createViewerStore();
    store.setState({ document: makeDoc(), adapter: new ThrowingExportAdapter(), _source: bufferSource() });
    const createObjectURL = vi.fn((_: Blob) => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await store.getState().downloadDocument();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
