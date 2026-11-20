import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type {
  Adapter,
  AdapterManifest,
  AdapterRegistry,
  DocumentModel,
  FormatId,
  RenderResult,
} from '../types';
import { bufferSource, makeDoc, manifest } from './test-fixtures';

class CountingAdapter implements Adapter {
  readonly manifest = manifest({ annotations: true });
  disposeCount = 0;
  async parse(): Promise<DocumentModel> {
    return makeDoc();
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

describe('failed document replacement', () => {
  it('clears document, source, and annotations when the new open fails', async () => {
    const store = createViewerStore();
    const adapterA = new CountingAdapter();
    const registry = new TestRegistry(adapterA);
    store.getState().setRegistry(registry);

    await store.getState().openDocument(bufferSource());
    expect(store.getState().loadState).toBe('loaded');
    expect(store.getState().document).not.toBeNull();

    store.setState({
      annotations: [
        {
          id: 'x',
          pageIndex: 0,
          type: 'highlight',
          color: '#ffd400',
          opacity: 0.4,
          createdAt: 1,
          updatedAt: 1,
          data: { rects: [] },
        },
      ],
    });

    registry.format = null;
    await store.getState().openDocument(bufferSource('b.bogus'));

    expect(store.getState().loadState).toBe('error');
    expect(store.getState().document).toBeNull();
    expect(store.getState()._source).toBeNull();
    expect(store.getState().annotations).toEqual([]);
    expect(adapterA.disposeCount).toBeGreaterThanOrEqual(1);
  });
});
