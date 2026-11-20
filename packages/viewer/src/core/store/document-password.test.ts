import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import { ViewerError } from '../errors';
import { DeferredAdapter, flush, makeDoc, reader, source } from './test-fixtures';

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
