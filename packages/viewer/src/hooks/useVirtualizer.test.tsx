import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createViewerStore } from '../core/store';
import { makeDoc } from '../core/store/test-fixtures';
import { ViewerStoreProvider } from './useDocViewer';
import { useVirtualizerHook } from './useVirtualizer';
import { PAGE_GAP } from '../components/Viewer/layout';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

type Result = ReturnType<typeof useVirtualizerHook>;

function mount(store: ReturnType<typeof createViewerStore>) {
  const result: { current: Result | null } = { current: null };
  function Probe() {
    const ref = useRef<HTMLDivElement>(null);
    result.current = useVirtualizerHook(ref);
    return <div ref={ref} />;
  }
  root = createRoot(document.createElement('div'));
  act(() =>
    root!.render(
      <ViewerStoreProvider store={store}>
        <Probe />
      </ViewerStoreProvider>,
    ),
  );
  return result;
}

function tallDoc(pageCount: number) {
  const doc = makeDoc(pageCount);
  return { ...doc, pages: doc.pages.map((p) => ({ ...p, width: 100, height: 200 })) };
}

describe('useVirtualizerHook', () => {
  it('lays out rows like the viewer: spreads share a row and every row has the page gap', () => {
    const store = createViewerStore();
    store.setState({ document: tallDoc(10), loadState: 'loaded', zoom: 1.5, spreadMode: 'even' });
    const result = mount(store);
    expect(result.current!.virtualizer.options.count).toBe(5);
    expect(result.current!.rows[1]).toEqual([2, 3]);
    expect(result.current!.virtualizer.getTotalSize()).toBe(5 * (300 + PAGE_GAP));
  });

  it('follows a rotation, even though the row count stays the same', () => {
    const store = createViewerStore();
    store.setState({ document: tallDoc(4), loadState: 'loaded', zoom: 1 });
    const result = mount(store);
    expect(result.current!.virtualizer.getTotalSize()).toBe(4 * (200 + PAGE_GAP));
    act(() => store.getState().rotateClockwise());
    expect(result.current!.virtualizer.getTotalSize()).toBe(4 * (100 + PAGE_GAP));
  });

  it('measures whole pixels, so estimates match what the browser reports', () => {
    const store = createViewerStore();
    store.setState({ document: tallDoc(3), loadState: 'loaded', zoom: 1.2345 });
    const result = mount(store);
    const { measurementsCache } = result.current!.virtualizer;
    const sizes = Array.from({ length: 3 }, (_, i) => measurementsCache[i]!.size);
    expect(sizes).toEqual([247 + PAGE_GAP, 247 + PAGE_GAP, 247 + PAGE_GAP]);
  });

  it('forgets measured sizes when the layout changes', () => {
    const store = createViewerStore();
    store.setState({ document: tallDoc(4), loadState: 'loaded', zoom: 1 });
    const result = mount(store);
    act(() => result.current!.virtualizer.resizeItem(0, 999));
    expect(result.current!.virtualizer.getTotalSize()).toBe(999 + 3 * (200 + PAGE_GAP));
    act(() => store.getState().setScrollMode('horizontal'));
    expect(result.current!.virtualizer.getTotalSize()).toBe(4 * (100 + PAGE_GAP));
  });
});
