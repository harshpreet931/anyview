import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSource,
  FileSourceReader,
  RenderResult,
} from '../types';

const MANIFEST: AdapterManifest = {
  id: 'pdf',
  label: 'PDF',
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  icon: '',
  features: {
    search: false,
    annotations: false,
    textSelection: false,
    print: false,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: false,
    download: false,
  },
  priority: 100,
  protocolVersion: 1,
};

class DeferredAdapter implements Adapter {
  readonly manifest = MANIFEST;
  disposeCount = 0;
  private resolve!: (model: DocumentModel) => void;
  private reject!: (err: unknown) => void;

  parse(): Promise<DocumentModel> {
    return new Promise<DocumentModel>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
  settle(model: DocumentModel): void {
    this.resolve(model);
  }
  fail(err: unknown): void {
    this.reject(err);
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
  dispose(): void {
    this.disposeCount += 1;
  }
}

const reader = {
  meta: { name: 't.pdf', size: 0, mimeType: 'application/pdf' },
  arrayBuffer: async () => new ArrayBuffer(0),
} as unknown as FileSourceReader;

const source = { name: 't.pdf' } as unknown as FileSource;

function makeDoc(): DocumentModel {
  return {
    format: 'pdf',
    meta: { name: 't.pdf', size: 0, mimeType: 'application/pdf' },
    pageCount: 1,
    pages: [{ index: 0, width: 100, height: 100, rotation: 0 }],
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('document parse abort', () => {
  it('disposes the in-flight adapter when parsing is aborted then resolves', async () => {
    const store = createViewerStore();
    const adapter = new DeferredAdapter();
    const controller = new AbortController();

    const running = store
      .getState()
      ._runParse(adapter, reader, controller, source);
    await flush();

    controller.abort();
    adapter.settle(makeDoc());
    await running;

    expect(adapter.disposeCount).toBe(1);
    expect(store.getState().loadState).not.toBe('loaded');
    expect(store.getState().document).toBeNull();
  });

  it('disposes the in-flight adapter when an aborted parse rejects', async () => {
    const store = createViewerStore();
    const adapter = new DeferredAdapter();
    const controller = new AbortController();

    const running = store
      .getState()
      ._runParse(adapter, reader, controller, source);
    await flush();

    controller.abort();
    adapter.fail(new Error('boom'));
    await running;

    expect(adapter.disposeCount).toBe(1);
    expect(store.getState().document).toBeNull();
  });
});
