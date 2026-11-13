import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import { createRegistry } from '../registry';
import type { Adapter, AdapterManifest, DocumentModel, RenderResult } from '../types';

const FEATURES = {
  search: false, annotations: false, textSelection: false, print: false, thumbnails: false,
  outline: false, zoom: true, rotation: true, attachments: false, fullscreen: false, download: false,
};

function manifest(id: 'pdf' | 'image', ext: string): AdapterManifest {
  return { id, label: id, extensions: [ext], mimeTypes: [], icon: '', features: FEATURES, priority: 1, protocolVersion: 1 };
}

function adapterFor(m: AdapterManifest, pages: number) {
  return class implements Adapter {
    readonly manifest = m;
    async parse(): Promise<DocumentModel> {
      return {
        format: m.id,
        meta: { name: 'x', size: 0, mimeType: '' },
        pageCount: pages,
        pages: Array.from({ length: pages }, (_, i) => ({ index: i, width: 100, height: 100, rotation: 0 as const })),
      };
    }
    async renderPage(): Promise<RenderResult> {
      return { width: 100, height: 100 };
    }
  };
}

describe('per-document view state', () => {
  it('does not carry a two-page spread or rotation into the next document', async () => {
    const registry = createRegistry();
    const pdf = manifest('pdf', 'pdf');
    const image = manifest('image', 'svg');
    registry.register(pdf, async () => ({ default: adapterFor(pdf, 4) }));
    registry.register(image, async () => ({ default: adapterFor(image, 1) }));

    const store = createViewerStore();
    store.getState().setRegistry(registry);
    await store.getState().openDocument({ kind: 'buffer', buffer: new ArrayBuffer(4), name: 'a.pdf', type: '' });
    store.getState().setSpreadMode('odd');
    store.getState().rotateClockwise();

    await store.getState().openDocument({ kind: 'buffer', buffer: new ArrayBuffer(4), name: 'b.svg', type: '' });
    expect(store.getState().loadState).toBe('loaded');
    expect(store.getState().spreadMode).toBe('none');
    expect(store.getState().rotation).toBe(0);
  });
});
