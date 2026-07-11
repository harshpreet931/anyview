import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import { ViewerError } from '../errors';
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
  parseCount = 0;
  private resolve!: (model: DocumentModel) => void;
  private reject!: (err: unknown) => void;

  parse(): Promise<DocumentModel> {
    this.parseCount += 1;
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

function seedPending(adapter: DeferredAdapter) {
  const store = createViewerStore();
  store.setState({
    _pendingPassword: { adapter, reader, source },
    loadState: 'error',
    loadError: new ViewerError('PASSWORD_REQUIRED', 'locked'),
  });
  return store;
}

describe('document slice password flow', () => {
  it('does not load a disposed adapter when cancelled mid-retry', async () => {
    const adapter = new DeferredAdapter();
    const store = seedPending(adapter);

    const submit = store.getState().submitPassword('correct');
    await flush();

    store.getState().cancelPassword();
    adapter.settle(makeDoc());
    await submit;
    await flush();

    expect(store.getState().loadState).toBe('idle');
    expect(store.getState().document).toBeNull();
    expect(store.getState().adapter).toBeNull();
    expect(adapter.disposeCount).toBeGreaterThanOrEqual(1);
  });

  it('ignores a duplicate submit while one is in flight', async () => {
    const adapter = new DeferredAdapter();
    const store = seedPending(adapter);

    store.getState().submitPassword('first');
    await flush();
    expect(adapter.parseCount).toBe(1);

    store.getState().submitPassword('second');
    await flush();
    expect(adapter.parseCount).toBe(1);

    adapter.settle(makeDoc());
    await flush();
    expect(store.getState().loadState).toBe('loaded');
  });

  it('loads normally when the correct password parse completes', async () => {
    const adapter = new DeferredAdapter();
    const store = seedPending(adapter);

    const submit = store.getState().submitPassword('correct');
    await flush();
    adapter.settle(makeDoc());
    await submit;

    expect(store.getState().loadState).toBe('loaded');
    expect(store.getState().document).not.toBeNull();
    expect(store.getState()._pendingPassword).toBeNull();
  });
});
