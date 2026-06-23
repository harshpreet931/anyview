import { describe, it, expect } from 'vitest';
import { createRegistry } from './registry';
import type {
  Adapter,
  AdapterFeatures,
  AdapterManifest,
  DocumentModel,
  RenderResult,
} from './types';

const NO_FEATURES: AdapterFeatures = {
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
};

function manifest(overrides: Partial<AdapterManifest> = {}): AdapterManifest {
  return {
    id: 'text',
    label: 'Text',
    extensions: ['txt'],
    mimeTypes: ['text/plain'],
    icon: '',
    features: NO_FEATURES,
    priority: 100,
    protocolVersion: 1,
    ...overrides,
  };
}

let constructed = 0;

class CountingAdapter implements Adapter {
  readonly manifest = manifest();
  constructor() {
    constructed++;
  }
  async parse(): Promise<DocumentModel> {
    return { format: 'text', meta: { name: 'x', size: 0, mimeType: 'text/plain' }, pageCount: 0, pages: [] };
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
}

describe('createRegistry', () => {
  it('registers manifests and detects formats', () => {
    const reg = createRegistry();
    reg.register(manifest(), async () => ({ default: CountingAdapter }));
    expect(reg.getManifest('text')?.id).toBe('text');
    expect(reg.detectFormat('a.txt')).toBe('text');
  });

  it('returns a FRESH adapter instance per load (no shared singleton)', async () => {
    constructed = 0;
    const reg = createRegistry();
    reg.register(manifest(), async () => ({ default: CountingAdapter }));

    const a = await reg.loadAdapter('text');
    const b = await reg.loadAdapter('text');

    expect(a).not.toBe(b);
    expect(constructed).toBe(2);
    expect(a.manifest.id).toBe('text');
  });

  it('rejects incompatible protocol versions', () => {
    const reg = createRegistry();
    expect(() =>
      reg.register(manifest({ protocolVersion: 99 }), async () => ({
        default: CountingAdapter,
      })),
    ).toThrow();
  });

  it('keeps the higher-priority manifest when re-registered', () => {
    const reg = createRegistry();
    reg.register(manifest({ priority: 200, label: 'High' }), async () => ({ default: CountingAdapter }));
    reg.register(manifest({ priority: 50, label: 'Low' }), async () => ({ default: CountingAdapter }));
    expect(reg.getManifest('text')?.label).toBe('High');
  });
});
