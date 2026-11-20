import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type { Adapter, AdapterManifest, AdapterRegistry, FormatId } from '../types';
import { bufferSource } from './test-fixtures';

class OfflineRegistry implements AdapterRegistry {
  register(): void {}
  getManifests(): readonly AdapterManifest[] {
    return [];
  }
  detectFormat(): FormatId | null {
    return 'pdf';
  }
  getManifest(): AdapterManifest | null {
    return null;
  }
  async loadAdapter(): Promise<Adapter> {
    throw new TypeError('Failed to fetch dynamically imported module');
  }
  unloadAdapter(): void {}
  onRegister(): () => void {
    return () => {};
  }
}

describe('a format engine that cannot be downloaded', () => {
  it('shows an error instead of loading forever', async () => {
    const store = createViewerStore();
    store.getState().setRegistry(new OfflineRegistry());
    await store.getState().openDocument(bufferSource());
    expect(store.getState().loadState).toBe('error');
    expect(store.getState().loadError?.code).toBe('PARSE_ERROR');
  });
});
