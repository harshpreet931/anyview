import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type {
  Adapter,
  AdapterManifest,
  AdapterRegistry,
  Annotation,
  DocumentModel,
  FileSource,
  FormatId,
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
    annotations: true,
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

class CountingAdapter implements Adapter {
  readonly manifest = MANIFEST;
  disposeCount = 0;
  async parse(): Promise<DocumentModel> {
    return docA();
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
  dispose(): void {
    this.disposeCount += 1;
  }
}

class TestRegistry implements AdapterRegistry {
  format: FormatId | null = 'pdf';
  constructor(private readonly adapter: Adapter) {}
  register(): void {}
  getManifests(): readonly AdapterManifest[] {
    return [];
  }
  detectFormat(): FormatId | null {
    return this.format;
  }
  getManifest(): AdapterManifest | null {
    return null;
  }
  async loadAdapter(): Promise<Adapter> {
    return this.adapter;
  }
  unloadAdapter(): void {}
  onRegister(): () => void {
    return () => {};
  }
}

function docA(): DocumentModel {
  return {
    format: 'pdf',
    meta: { name: 'a.pdf', size: 0, mimeType: 'application/pdf' },
    pageCount: 1,
    pages: [{ index: 0, width: 100, height: 100, rotation: 0 }],
  };
}

function bufferSource(name: string): FileSource {
  return { kind: 'buffer', buffer: new ArrayBuffer(4), name, type: 'application/pdf' };
}

describe('failed document replacement', () => {
  it('clears document, source, and annotations when the new open fails', async () => {
    const store = createViewerStore();
    const adapterA = new CountingAdapter();
    const registry = new TestRegistry(adapterA);
    store.getState().setRegistry(registry);

    await store.getState().openDocument(bufferSource('a.pdf'));
    expect(store.getState().loadState).toBe('loaded');
    expect(store.getState().document).not.toBeNull();

    store.setState({ annotations: [{ id: 'x' } as unknown as Annotation] });

    registry.format = null;
    await store.getState().openDocument(bufferSource('b.bogus'));

    expect(store.getState().loadState).toBe('error');
    expect(store.getState().document).toBeNull();
    expect(store.getState()._source).toBeNull();
    expect(store.getState().annotations).toEqual([]);
    expect(adapterA.disposeCount).toBeGreaterThanOrEqual(1);
  });
});
