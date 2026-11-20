import { describe, it, expect, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createViewerStore, type ViewerStore } from '../core/store';
import { useStoreListener } from './useStoreListener';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const selectVisiblePages = (s: ViewerStore) => s.visiblePages;
const samePages = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((p, i) => p === b[i]);

function mount(store: ReturnType<typeof createViewerStore>, listener: (pages: readonly number[]) => void, equality?: typeof samePages) {
  function Probe() {
    useStoreListener(store, selectVisiblePages, listener, equality);
    return null;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  return () => act(() => root.unmount());
}

describe('useStoreListener', () => {
  it('skips a new array with the same pages when given an equality function', () => {
    const store = createViewerStore();
    const listener = vi.fn();
    const unmount = mount(store, listener, samePages);
    act(() => store.setState({ visiblePages: [0, 1] }));
    act(() => store.setState({ visiblePages: [0, 1] }));
    act(() => store.setState({ visiblePages: [1, 2] }));
    expect(listener.mock.calls.map((c) => c[0])).toEqual([[0, 1], [1, 2]]);
    unmount();
  });

  it('stops listening on unmount', () => {
    const store = createViewerStore();
    const listener = vi.fn();
    mount(store, listener)();
    act(() => store.setState({ visiblePages: [3] }));
    expect(listener).not.toHaveBeenCalled();
  });
});
