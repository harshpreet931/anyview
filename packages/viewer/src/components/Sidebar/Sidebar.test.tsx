import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createViewerStore } from '../../core/store';
import { makeDoc, manifest } from '../../core/store/test-fixtures';
import { ViewerStoreProvider } from '../../hooks/useDocViewer';
import type { Adapter, RenderContext, RenderResult } from '../../core/types';
import { Sidebar } from './Sidebar';

const pageLabels = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../i18n/strings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../i18n/strings')>();
  return {
    ...actual,
    formatString: (template: string, ...args: Array<string | number>) => {
      if (template === 'Page {0}') pageLabels.count++;
      return actual.formatString(template, ...args);
    },
  };
});

const PANEL_HEIGHT = 600;
const ITEM_HEIGHT = 200;
const originals = {
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!,
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!,
  clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!,
};

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const isPanel = (el: Element) => el.getAttribute('role') === 'tabpanel';
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (isPanel(this)) return PANEL_HEIGHT;
      return this.hasAttribute('data-index') ? ITEM_HEIGHT : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return isPanel(this) ? 200 : 0;
    },
  });
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      return isPanel(this) ? 200 : 0;
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originals.offsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originals.offsetWidth);
  Object.defineProperty(Element.prototype, 'clientWidth', originals.clientWidth);
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function adapterWith(renderPage: (ctx: RenderContext) => Promise<RenderResult>): Adapter {
  return {
    manifest: manifest({ thumbnails: true }),
    parse: async () => makeDoc(),
    renderPage,
  } as unknown as Adapter;
}

async function mountSidebar(adapter: Adapter, pages = 1000) {
  const store = createViewerStore();
  store.setState({ document: makeDoc(pages), adapter, sidebarOpen: true, sidebarView: 'thumbnails', currentPage: 0 });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <ViewerStoreProvider store={store}>
        <Sidebar />
      </ViewerStoreProvider>,
    ),
  );
  await act(() => new Promise((r) => setTimeout(r, 20)));
  return store;
}

const drawn = (ctx: RenderContext): Promise<RenderResult> => {
  const canvas = ctx.target as HTMLCanvasElement;
  canvas.width = 300;
  canvas.height = 300;
  return Promise.resolve({ width: 150, height: 150 });
};

describe('Sidebar thumbnails', () => {
  it('re-renders only the previously and newly current thumbnails on a page change', async () => {
    const store = await mountSidebar(adapterWith(drawn));
    expect(host!.querySelectorAll('.dv-thumbnail').length).toBeLessThan(30);

    pageLabels.count = 0;
    await act(async () => store.getState().setCurrentPage(1));
    expect(pageLabels.count).toBe(2);
  });

  it('closes the bitmap a thumbnail render returns', async () => {
    const closes: Array<() => void> = [];
    await mountSidebar(
      adapterWith(async (ctx) => {
        await drawn(ctx);
        const close = vi.fn();
        closes.push(close);
        return { width: 150, height: 150, bitmap: { close } as unknown as ImageBitmap };
      }),
      3,
    );
    expect(closes.length).toBe(3);
    for (const close of closes) expect(close).toHaveBeenCalledTimes(1);
  });

  it('frees drawn canvases and cancels in-flight renders when thumbnails unmount', async () => {
    const signals: AbortSignal[] = [];
    const store = await mountSidebar(
      adapterWith((ctx) => {
        if (ctx.page.index === 0) return drawn(ctx);
        signals.push(ctx.signal);
        return new Promise(() => {});
      }),
      3,
    );
    const canvas = host!.querySelector<HTMLCanvasElement>('.dv-thumbnail-canvas')!;
    expect(canvas.width).toBe(300);
    expect(signals.length).toBe(2);

    await act(async () => store.setState({ sidebarOpen: false }));
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    for (const signal of signals) expect(signal.aborted).toBe(true);
  });
});
