import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createViewerStore } from '../../core/store';
import { ViewerStoreProvider } from '../../hooks/useDocViewer';
import type { Adapter } from '../../core/types';
import { TextLayer } from './TextLayer';

let reads = 0;

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      reads++;
      return 50;
    },
  });
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  vi.useRealTimers();
  host?.remove();
  root = null;
  host = null;
});

const items = Array.from({ length: 40 }, (_, i) => ({
  str: `run ${i}`,
  x: 0.1,
  y: i / 40,
  width: 0.2,
  height: 0.02,
  angle: 0,
}));

describe('TextLayer', () => {
  it('measures each run once, not again on every zoom', async () => {
    const store = createViewerStore();
    store.setState({
      adapter: { getTextLayer: async () => ({ pageIndex: 0, items }) } as unknown as Adapter,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const render = (w: number) =>
      act(() =>
        root!.render(
          <ViewerStoreProvider store={store}>
            <TextLayer pageIndex={0} width={w} height={w * 1.3} />
          </ViewerStoreProvider>,
        ),
      );

    vi.useFakeTimers();
    render(600);
    await act(async () => vi.advanceTimersByTime(1000));
    const spans = host.querySelectorAll<HTMLElement>('span[data-tw]');
    expect(spans.length).toBe(40);
    const first = reads;
    expect(first).toBeGreaterThan(0);
    const scaleAt600 = spans[0]!.style.transform;
    const styleAt600 = spans[5]!.getAttribute('style');

    render(900);
    render(1200);
    expect(reads).toBe(first);
    expect(host.querySelectorAll<HTMLElement>('span[data-tw]')[5]!.getAttribute('style')).toBe(styleAt600);
    expect(host.querySelector<HTMLElement>('span[data-tw]')!.style.transform).toBe(scaleAt600);
  });

  it('asks for text only once the page has stayed mounted, and cancels it on unmount', () => {
    vi.useFakeTimers();
    const getTextLayer = vi.fn((_page: number, _signal?: AbortSignal) => new Promise<never>(() => {}));
    const store = createViewerStore();
    store.setState({ adapter: { getTextLayer } as unknown as Adapter });
    host = document.createElement('div');
    document.body.appendChild(host);
    const mount = () => {
      root = createRoot(host!);
      act(() =>
        root!.render(
          <ViewerStoreProvider store={store}>
            <TextLayer pageIndex={3} width={600} height={800} />
          </ViewerStoreProvider>,
        ),
      );
    };

    mount();
    act(() => vi.advanceTimersByTime(50));
    act(() => root!.unmount());
    act(() => vi.advanceTimersByTime(1000));
    expect(getTextLayer).not.toHaveBeenCalled();

    mount();
    act(() => vi.advanceTimersByTime(1000));
    expect(getTextLayer).toHaveBeenCalledTimes(1);
    const signal = getTextLayer.mock.calls[0]![1]!;
    expect(signal.aborted).toBe(false);
    act(() => root!.unmount());
    root = null;
    expect(signal.aborted).toBe(true);
  });
});
