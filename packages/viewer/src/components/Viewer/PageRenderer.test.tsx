import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createViewerStore } from '../../core/store';
import { makeDoc, manifest } from '../../core/store/test-fixtures';
import type { Adapter } from '../../core/types';
import { ViewerStoreProvider } from '../../hooks/useDocViewer';
import { PageRenderer } from './PageRenderer';

const renders = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../hooks/useDomSearch', () => ({
  useDomSearch: () => {
    renders.count++;
  },
}));

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  renders.count = 0;
});

function loadedStore() {
  const store = createViewerStore();
  const adapter = {
    manifest: manifest(),
    renderPage: () => new Promise(() => {}),
  } as unknown as Adapter;
  store.setState({ document: makeDoc(3), adapter, loadState: 'loaded' });
  return store;
}

function mount(ui: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(ui));
  return host;
}

describe('PageRenderer', () => {
  it('does not re-render when only its parent does', () => {
    const store = loadedStore();
    let bump = () => {};
    function Parent() {
      const [n, setN] = useState(0);
      bump = () => setN(n + 1);
      return <PageRenderer pageIndex={0} />;
    }
    mount(
      <ViewerStoreProvider store={store}>
        <Parent />
      </ViewerStoreProvider>,
    );
    const before = renders.count;
    act(() => bump());
    act(() => bump());
    expect(renders.count).toBe(before);
  });

  it('plays the enter animation only the first time a page appears', () => {
    const store = loadedStore();
    let show: (v: boolean) => void = () => {};
    function Parent() {
      const [visible, setVisible] = useState(true);
      show = setVisible;
      return visible ? <PageRenderer pageIndex={1} /> : null;
    }
    const el = mount(
      <ViewerStoreProvider store={store}>
        <Parent />
      </ViewerStoreProvider>,
    );
    expect(el.querySelector('.dv-page')!.classList.contains('dv-page-new')).toBe(true);
    act(() => show(false));
    act(() => show(true));
    expect(el.querySelector('.dv-page')!.classList.contains('dv-page-new')).toBe(false);
  });
});
