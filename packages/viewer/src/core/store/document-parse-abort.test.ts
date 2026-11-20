import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import { DeferredAdapter, flush, makeDoc, reader, source } from './test-fixtures';

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
